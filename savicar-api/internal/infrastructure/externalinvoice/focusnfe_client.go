package externalinvoice

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/url"
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
func (c *FocusNfeClient) CreateServiceInvoice(ctx context.Context, apiKey, ref string, payload []byte) (int, []byte, error) {
	reqURL := focusNfeBaseURL + "/v2/nfsen?ref=" + url.QueryEscape(ref)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	setFocusAuth(req, apiKey)

	c.log.InfoContext(ctx, "focus nfe request",
		slog.String("method", req.Method), slog.String("url", reqURL), slog.String("ref", ref), slog.String("payload", string(payload)))
	return c.doLogged(req, ref)
}

func (c *FocusNfeClient) GetServiceInvoiceStatus(ctx context.Context, apiKey, ref string) (int, []byte, error) {
	reqURL := focusNfeBaseURL + "/v2/nfsen/" + url.PathEscape(ref)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return 0, nil, err
	}
	setFocusAuth(req, apiKey)

	c.log.InfoContext(ctx, "focus nfe request",
		slog.String("method", req.Method), slog.String("url", reqURL), slog.String("ref", ref))
	return c.doLogged(req, ref)
}

// doLogged performs the request and logs the response (or the error), so
// every send/receive with Focus NFe is traceable in savicar-api.log — in
// dev and in production alike, since it goes through the shared slog logger.
func (c *FocusNfeClient) doLogged(req *http.Request, ref string) (int, []byte, error) {
	status, body, err := c.do(req)
	if err != nil {
		c.log.ErrorContext(req.Context(), "focus nfe request failed", slog.String("ref", ref), slog.Any("error", err))
		return status, body, err
	}
	c.log.InfoContext(req.Context(), "focus nfe response",
		slog.String("ref", ref), slog.Int("status", status), slog.String("body", string(body)))
	return status, body, err
}

// setFocusAuth sets the Authorization header directly from
// TENANT_CONFIG.API_KEY_NF, which is stored already base64-encoded — not
// re-encoded here via http.Request.SetBasicAuth, which would double-encode
// it and get rejected by Focus as an invalid token.
func setFocusAuth(req *http.Request, apiKey string) {
	req.Header.Set("Authorization", "Basic "+apiKey)
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
