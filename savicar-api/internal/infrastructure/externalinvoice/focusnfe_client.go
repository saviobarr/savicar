package externalinvoice

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Focus NFe production API. NFS-e Nacional (DPS) endpoints.
const focusNfeBaseURL = "https://api.focusnfe.com.br"

type FocusNfeClient struct {
	httpClient *http.Client
	log        *slog.Logger
}

func NewFocusNfeClient() *FocusNfeClient {
	return &FocusNfeClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		log:        slog.Default().WithGroup("focusnfe"),
	}
}

// CreateServiceInvoice enqueues a DPS for asynchronous authorization under
// ref. Focus responds immediately (the note is not authorized yet) —
// GetServiceInvoiceStatus must be polled with the same ref for the result.
// The returned curl string reproduces the exact request sent, for the
// frontend to show alongside a rejected response so the failure can be
// reproduced/reported without digging through the log file.
func (c *FocusNfeClient) CreateServiceInvoice(ctx context.Context, apiKey, ref, cliente string, payload []byte) (statusCode int, body []byte, curl string, err error) {
	reqURL := focusNfeBaseURL + "/v2/nfsen?ref=" + url.QueryEscape(ref)
	curl = curlCommand(http.MethodPost, reqURL, apiKey, payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return 0, nil, curl, err
	}
	req.Header.Set("Content-Type", "application/json")
	setFocusAuth(req, apiKey)

	logArgs := []any{slog.String("method", req.Method), slog.String("url", reqURL), slog.String("ref", ref), slog.String("payload", string(payload)), slog.String("curl", curl)}
	if cliente != "" {
		logArgs = append(logArgs, slog.String("cliente", cliente))
	}
	c.log.InfoContext(ctx, "focus nfe request", logArgs...)
	statusCode, body, err = c.doLogged(req, ref, cliente, curl)
	return statusCode, body, curl, err
}

func (c *FocusNfeClient) GetServiceInvoiceStatus(ctx context.Context, apiKey, ref, cliente string) (statusCode int, body []byte, curl string, err error) {
	reqURL := focusNfeBaseURL + "/v2/nfsen/" + url.PathEscape(ref)
	curl = curlCommand(http.MethodGet, reqURL, apiKey, nil)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return 0, nil, curl, err
	}
	setFocusAuth(req, apiKey)

	logArgs := []any{slog.String("method", req.Method), slog.String("url", reqURL), slog.String("ref", ref), slog.String("curl", curl)}
	if cliente != "" {
		logArgs = append(logArgs, slog.String("cliente", cliente))
	}
	c.log.InfoContext(ctx, "focus nfe request", logArgs...)
	statusCode, body, err = c.doLogged(req, ref, cliente, curl)
	return statusCode, body, curl, err
}

// doLogged performs the request and logs the response (or the error), so
// every send/receive with Focus NFe is traceable in savicar-api.log — in
// dev and in production alike, since it goes through the shared slog logger.
// A network-level failure or a >=400 response from Focus (e.g. a rejected
// or malformed request) is logged at Error, carrying the curl that
// reproduces it and, when known, the tomador's razão social — Error is what
// erroralert.Handler watches for, so this is also what turns into a
// WhatsApp alert naming which customer's DPS failed.
func (c *FocusNfeClient) doLogged(req *http.Request, ref, cliente, curl string) (int, []byte, error) {
	status, body, err := c.do(req)
	if err != nil {
		errArgs := []any{slog.String("ref", ref), slog.Any("error", err), slog.String("curl", curl)}
		if cliente != "" {
			errArgs = append(errArgs, slog.String("cliente", cliente))
		}
		c.log.ErrorContext(req.Context(), "focus nfe request failed", errArgs...)
		return status, body, err
	}
	if status >= 400 {
		errArgs := []any{slog.String("ref", ref), slog.Int("status", status), slog.String("body", string(body)), slog.String("curl", curl)}
		if cliente != "" {
			errArgs = append(errArgs, slog.String("cliente", cliente))
		}
		c.log.ErrorContext(req.Context(), "focus nfe request rejected", errArgs...)
		return status, body, err
	}
	c.log.InfoContext(req.Context(), "focus nfe response",
		slog.String("ref", ref), slog.Int("status", status), slog.String("body", string(body)))
	return status, body, err
}

// setFocusAuth sets HTTP Basic Auth from TENANT_CONFIG.API_KEY_NF using the
// raw access token shown in the Focus NFe dashboard as the username, with a
// blank password — the encoding Focus expects. Do not pre-base64-encode the
// stored value; that produces "Access token possui caracteres inválidos".
func setFocusAuth(req *http.Request, apiKey string) {
	req.SetBasicAuth(apiKey, "")
}

// curlCommand reproduces the request as a copy-pasteable curl invocation
// (same auth, same body) for reporting/debugging a rejected emission.
func curlCommand(method, reqURL, apiKey string, payload []byte) string {
	parts := []string{"curl", "-X", method, shQuote(reqURL), "-u", shQuote(apiKey + ":")}
	if len(payload) > 0 {
		parts = append(parts, "-H", shQuote("Content-Type: application/json"), "-d", shQuote(string(payload)))
	}
	return strings.Join(parts, " ")
}

func shQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

func (c *FocusNfeClient) do(req *http.Request) (int, []byte, error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, nil, err
	}
	return resp.StatusCode, body, nil
}
