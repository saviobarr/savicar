// Package httpcurl reproduces an HTTP request as a copy-pasteable curl
// invocation, for reporting/debugging a failed request without digging
// through the log file.
package httpcurl

import "strings"

type Header struct{ Key, Value string }

func Command(method, url string, headers []Header, body []byte) string {
	parts := []string{"curl", "-X", method, Quote(url)}
	for _, h := range headers {
		parts = append(parts, "-H", Quote(h.Key+": "+h.Value))
	}
	if len(body) > 0 {
		parts = append(parts, "-d", Quote(string(body)))
	}
	return strings.Join(parts, " ")
}

func Quote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
