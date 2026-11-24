package handler

import "github.com/gin-gonic/gin"

// contextInt reads an auth claim set by middleware.Auth. Numeric JWT claims
// decode as float64, so both that and plain int are handled.
func contextInt(c *gin.Context, key string) int {
	v, ok := c.Get(key)
	if !ok {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	}
	return 0
}

func contextString(c *gin.Context, key string) string {
	v, ok := c.Get(key)
	if !ok {
		return ""
	}
	s, _ := v.(string)
	return s
}
