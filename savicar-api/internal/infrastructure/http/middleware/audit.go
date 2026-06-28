package middleware

import (
	"bytes"
	"context"
	"io"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"savicar-api/internal/domain/audit"
)

var auditMethods = map[string]bool{
	"POST":   true,
	"PUT":    true,
	"DELETE": true,
	"PATCH":  true,
}

func Audit(repo audit.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !auditMethods[c.Request.Method] || shouldSkip(c.Request.URL.Path) {
			c.Next()
			return
		}

		// Read and restore the body so the handler can still consume it.
		var bodyStr *string
		if c.Request.Body != nil {
			bodyBytes, err := io.ReadAll(c.Request.Body)
			if err == nil && len(bodyBytes) > 0 {
				s := string(bodyBytes)
				bodyStr = &s
				c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			}
		}

		c.Next()

		userName, _ := c.Get("user_name")
		user := "unknown"
		if s, ok := userName.(string); ok && s != "" {
			user = s
		}

		idTenant := 0
		if v, ok := c.Get("id_tenant"); ok {
			switch n := v.(type) {
			case float64:
				idTenant = int(n)
			case int:
				idTenant = n
			}
		}

		url := c.Request.Method + " " + c.FullPath()
		if c.FullPath() == "" {
			url = c.Request.Method + " " + c.Request.URL.Path
		}
		if qs := c.Request.URL.RawQuery; qs != "" {
			url += "?" + qs
		}

		entry := &audit.Audit{
			IDTenant:  idTenant,
			User:      user,
			URLCalled: truncate(url, 255),
			Payload:   bodyStr,
			DateTime:  time.Now(),
		}

		go func() {
			_ = repo.Save(context.Background(), entry)
		}()
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// skipAudit paths that should never be audited
func shouldSkip(path string) bool {
	return strings.HasPrefix(path, "/swagger") || path == "/auth/login"
}
