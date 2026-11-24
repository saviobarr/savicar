package handler

import (
	"database/sql"
	"net/http"
	"os"
	"time"
	_ "time/tzdata" // bundled so APP_TIMEZONE works on hosts without a zoneinfo database (Windows)

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type loginRequest struct {
	UserName string `json:"user_name" binding:"required"`
	Password string `json:"password"  binding:"required"`
}

type loginResponse struct {
	Token    string `json:"token"`
	IDUser   int    `json:"id_user"`
	IDTenant int    `json:"id_tenant"`
	Name     string `json:"name"`
	Profile  int    `json:"profile"`
}

func jwtSecret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	return []byte("savicar-default-secret-change-in-prod")
}

// appLocation is the timezone used for the server clock handed to the frontend
// (APP_TIMEZONE, default America/Sao_Paulo; falls back to the host's local zone).
func appLocation() *time.Location {
	name := os.Getenv("APP_TIMEZONE")
	if name == "" {
		name = "America/Sao_Paulo"
	}
	if loc, err := time.LoadLocation(name); err == nil {
		return loc
	}
	return time.Local
}

func RegisterAuthRoutes(r *gin.Engine, db *sql.DB) {
	// The server's clock, so screens don't depend on each machine's (possibly wrong) local time.
	// "now" has the same shape as an <input type="datetime-local"> value (yyyy-mm-ddThh:mm).
	r.GET("/auth/server-time", func(c *gin.Context) {
		now := time.Now().In(appLocation())
		c.JSON(http.StatusOK, gin.H{
			"now": now.Format("2006-01-02T15:04"),
			"iso": now.Format(time.RFC3339),
		})
	})

	r.POST("/auth/login", func(c *gin.Context) {
		var req loginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_name e password são obrigatórios"})
			return
		}

		var idUser, idTenant int
		var name, hashedPwd string
		var profile int
		err := db.QueryRowContext(c.Request.Context(),
			"SELECT ID_USER, ID_TENANT, NAME, PASSWORD, PROFILE FROM USERS WHERE USER_NAME = ?",
			req.UserName,
		).Scan(&idUser, &idTenant, &name, &hashedPwd, &profile)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuário ou senha inválidos"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(hashedPwd), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuário ou senha inválidos"})
			return
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub":       idUser,
			"name":      name,
			"profile":   profile,
			"id_tenant": idTenant,
			"exp":       time.Now().Add(12 * time.Hour).Unix(),
		})
		signed, err := token.SignedString(jwtSecret())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar token"})
			return
		}

		c.JSON(http.StatusOK, loginResponse{
			Token:    signed,
			IDUser:   idUser,
			IDTenant: idTenant,
			Name:     name,
			Profile:  profile,
		})
	})

	r.POST("/auth/bootstrap", func(c *gin.Context) {
		// Count existing users — refuse if any exist
		var count int
		if err := db.QueryRowContext(c.Request.Context(), "SELECT COUNT(*) FROM USERS").Scan(&count); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if count > 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "bootstrap desabilitado: já existem usuários cadastrados"})
			return
		}

		var req struct {
			Name     string `json:"name"      binding:"required"`
			UserName string `json:"user_name" binding:"required"`
			Password string `json:"password"  binding:"required"`
			IDTenant int    `json:"id_tenant" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name, user_name, password e id_tenant são obrigatórios"})
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar senha"})
			return
		}

		// Profile 1 = Admin
		_, err = db.ExecContext(c.Request.Context(),
			"INSERT INTO USERS (ID_TENANT, NAME, USER_NAME, PASSWORD, PROFILE) VALUES (?, ?, ?, ?, 1)",
			req.IDTenant, req.Name, req.UserName, string(hash),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"message": "usuário admin criado com sucesso"})
	})
}
