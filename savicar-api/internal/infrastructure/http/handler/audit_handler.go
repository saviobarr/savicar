package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"savicar-api/internal/domain/audit"
)

type AuditHandler struct {
	repo audit.Repository
}

func NewAuditHandler(repo audit.Repository) *AuditHandler {
	return &AuditHandler{repo: repo}
}

func (h *AuditHandler) RegisterRoutes(r gin.IRouter) {
	r.GET("/audit", h.getAll)
}

func (h *AuditHandler) getAll(c *gin.Context) {
	items, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []audit.Audit{}
	}
	c.JSON(http.StatusOK, items)
}
