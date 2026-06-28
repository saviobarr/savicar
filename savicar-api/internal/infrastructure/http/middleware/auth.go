package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func jwtSecret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	return []byte("savicar-default-secret-change-in-prod")
}

func Auth(indexHTML []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Browser page refresh on an API path: serve the SPA so React handles routing/auth.
		if c.Request.Method == http.MethodGet &&
			strings.Contains(c.GetHeader("Accept"), "text/html") &&
			!strings.HasPrefix(c.GetHeader("Authorization"), "Bearer ") {
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexHTML)
			c.Abort()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token ausente"})
			return
		}
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return jwtSecret(), nil
		}, jwt.WithValidMethods([]string{"HS256"}))

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token inválido ou expirado"})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", claims["sub"])
			c.Set("user_name", claims["name"])
			c.Set("profile", claims["profile"])
			c.Set("id_tenant", claims["id_tenant"])
		}
		c.Next()
	}
}
