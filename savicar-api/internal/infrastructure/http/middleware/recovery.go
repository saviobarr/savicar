package middleware

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"

	"github.com/gin-gonic/gin"

	"savicar-api/internal/infrastructure/httpcurl"
)

// Recovery catches panics from any handler and logs them via slog.Error
// with a stack trace and a curl reproducing the request that triggered it,
// instead of Gin's own recovery, which only prints to its log writer.
// Routing through slog means a panic also flows through erroralert.Handler
// (see main.go's setupLogging) and triggers a WhatsApp notification like
// any other Error-level log line.
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Read+restore the body up front: if a handler further down
		// consumes it before panicking, it would otherwise be gone by the
		// time the deferred recover below tries to reproduce the request.
		var reqBody []byte
		if c.Request.Body != nil {
			reqBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewReader(reqBody))
		}

		defer func() {
			if rec := recover(); rec != nil {
				slog.Default().Error("panic recovered",
					slog.Any("panic", rec),
					slog.String("stack", string(debug.Stack())),
					slog.String("method", c.Request.Method),
					slog.String("path", c.Request.URL.Path),
					slog.String("curl", requestCurl(c.Request, reqBody)),
				)
				c.AbortWithStatus(http.StatusInternalServerError)
			}
		}()
		c.Next()
	}
}

// requestCurl reproduces the incoming request (method, URL, headers, body)
// as a copy-pasteable curl invocation, so a panic report is reproducible
// without digging through the log file. Authorization is redacted — it's a
// bearer JWT, not something to hand out in a WhatsApp message.
func requestCurl(r *http.Request, body []byte) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	fullURL := fmt.Sprintf("%s://%s%s", scheme, r.Host, r.URL.RequestURI())

	var headers []httpcurl.Header
	for key, values := range r.Header {
		for _, v := range values {
			if strings.EqualFold(key, "Authorization") {
				v = "***redacted***"
			}
			headers = append(headers, httpcurl.Header{Key: key, Value: v})
		}
	}
	return httpcurl.Command(r.Method, fullURL, headers, body)
}
