// Package erroralert notifies a support WhatsApp number, through the same
// Evolution API server the rest of the app uses, whenever something logs an
// Error-level record — see Handler in handler.go for how that hooks into
// log/slog, and Recovery in the middleware package for how panics get there
// too.
package erroralert

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	defaultEvolutionURL = "http://10.0.0.168:8081"
	defaultEvolutionKey = "ad582ee8d908c0d437ac02c346ee7c747093fd676eeab8dcd633934a4b7ba843"
	defaultInstance     = "Suporte_Savicar"
	defaultPhone        = "47933880475"

	dedupWindow   = 10 * time.Minute
	maxStackChars = 2500
	maxCurlChars  = 2000
	maxBodyChars  = 1000
)

// Sender posts error alerts to WhatsApp via Evolution's sendText endpoint.
//
// It deliberately never logs through slog: Handler calls Notify for every
// Error-level record produced anywhere in the app, so if a failure here were
// logged via slog it would re-enter Handle and recurse forever the moment
// Evolution itself is unreachable. Sender only ever uses the standard "log"
// package, which main.go already points at the same file/stderr writer.
type Sender struct {
	baseURL  string
	apiKey   string
	instance string
	phone    string
	client   *http.Client

	mu         sync.Mutex
	lastSent   map[string]time.Time
	suppressed map[string]int
}

func NewSenderFromEnv() *Sender {
	return &Sender{
		baseURL:    strings.TrimRight(envOr("ERROR_ALERT_URL", envOr("EVOLUTION_API_URL", defaultEvolutionURL)), "/"),
		apiKey:     envOr("ERROR_ALERT_KEY", envOr("EVOLUTION_API_KEY", defaultEvolutionKey)),
		instance:   envOr("ERROR_ALERT_INSTANCE", defaultInstance),
		phone:      sanitizePhone(envOr("ERROR_ALERT_PHONE", defaultPhone)),
		client:     &http.Client{Timeout: 10 * time.Second},
		lastSent:   make(map[string]time.Time),
		suppressed: make(map[string]int),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Notify sends operation+message (plus any context attrs / stack trace) as a
// WhatsApp text message, fire-and-forget. Repeats of the same operation+
// message within dedupWindow are suppressed and folded into a single
// "(+N repetições)" note on the next send that goes through — otherwise a
// single flapping dependency (e.g. the DB going down) would flood WhatsApp.
func (s *Sender) Notify(operation, message string, attrs []slog.Attr) {
	key := operation + "|" + message

	s.mu.Lock()
	if last, ok := s.lastSent[key]; ok && time.Since(last) < dedupWindow {
		s.suppressed[key]++
		s.mu.Unlock()
		return
	}
	repeats := s.suppressed[key]
	s.suppressed[key] = 0
	s.lastSent[key] = time.Now()
	s.mu.Unlock()

	text := formatMessage(operation, message, attrs, repeats)
	go s.sendWithRetry(text)
}

// retryDelays is how long to wait before each re-attempt when the alert could
// not be delivered (support's Evolution unreachable, instance disconnected...).
// The very failures worth alerting about are often the ones that also take the
// alert channel down, so a single fire-and-forget attempt loses them for good.
var retryDelays = []time.Duration{30 * time.Second, 2 * time.Minute, 10 * time.Minute, 30 * time.Minute, time.Hour}

func (s *Sender) sendWithRetry(text string) {
	if s.send(text) {
		return
	}
	for _, d := range retryDelays {
		time.Sleep(d)
		if s.send(text) {
			return
		}
	}
	log.Printf("erroralert: giving up on alert after %d retries (url=%s instance=%s)", len(retryDelays), s.baseURL, s.instance)
}

func formatMessage(operation, message string, attrs []slog.Attr, repeats int) string {
	var b strings.Builder
	b.WriteString("🔴 *Erro no Savicar*\n")
	if operation != "" {
		fmt.Fprintf(&b, "*Operação:* %s\n", operation)
	}
	fmt.Fprintf(&b, "*Mensagem:* %s\n", message)

	var stack, curl, respBody string
	var ctx []string
	for _, a := range attrs {
		switch a.Key {
		case "stack":
			stack = a.Value.String()
		case "curl":
			curl = a.Value.String()
		case "body":
			respBody = a.Value.String()
		default:
			ctx = append(ctx, fmt.Sprintf("%s=%s", a.Key, a.Value.String()))
		}
	}
	if len(ctx) > 0 {
		fmt.Fprintf(&b, "*Contexto:* %s\n", strings.Join(ctx, "  "))
	}
	if repeats > 0 {
		fmt.Fprintf(&b, "_(+%d repetições nos últimos %s)_\n", repeats, dedupWindow)
	}
	if curl != "" {
		fmt.Fprintf(&b, "*cURL da operação:*\n```%s```\n", truncate(curl, maxCurlChars))
	}
	if respBody != "" {
		fmt.Fprintf(&b, "*Resposta:*\n```%s```\n", truncate(respBody, maxBodyChars))
	}
	if stack != "" {
		fmt.Fprintf(&b, "*Stack:*\n```%s```", truncate(stack, maxStackChars))
	}
	return b.String()
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "\n... (truncado)"
}

// send reports whether the alert was delivered.
func (s *Sender) send(text string) bool {
	payload := map[string]any{"number": s.phone, "text": text}
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("erroralert: marshal failed: %v", err)
		return true // not retryable
	}

	req, err := http.NewRequest(http.MethodPost, s.baseURL+"/message/sendText/"+s.instance, bytes.NewReader(body))
	if err != nil {
		log.Printf("erroralert: request build failed: %v", err)
		return true // not retryable
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		log.Printf("erroralert: evolution api unreachable: %v", err)
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 500))
		log.Printf("erroralert: evolution api returned status %d (url=%s instance=%s): %s", resp.StatusCode, s.baseURL, s.instance, raw)
		return false
	}
	return true
}

func sanitizePhone(p string) string {
	replacer := strings.NewReplacer(" ", "", "-", "", "(", "", ")", "", "+", "")
	p = replacer.Replace(p)
	if !strings.HasPrefix(p, "55") {
		p = "55" + p
	}
	return p
}
