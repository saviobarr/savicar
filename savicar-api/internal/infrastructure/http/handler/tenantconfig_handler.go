package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	apptenant "savicar-api/internal/application/tenantconfig"
	"savicar-api/internal/domain/tenantconfig"
)

type TenantConfigHandler struct {
	svc *apptenant.Service
}

func NewTenantConfigHandler(svc *apptenant.Service) *TenantConfigHandler {
	return &TenantConfigHandler{svc: svc}
}

// RegisterPublicRoutes registers routes that don't require authentication.
// Must be called before the auth middleware is applied.
func (h *TenantConfigHandler) RegisterPublicRoutes(r *gin.Engine) {
	r.GET("/tenant-config/logo", h.logo)
}

func (h *TenantConfigHandler) RegisterRoutes(r gin.IRouter) {
	r.GET("/tenant-config", h.get)
	r.PUT("/tenant-config", h.update)
}

func (h *TenantConfigHandler) get(c *gin.Context) {
	cfg, err := h.svc.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if cfg == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant config not found"})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *TenantConfigHandler) update(c *gin.Context) {
	var body tenantconfig.TenantConfig
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if err := h.svc.Update(c.Request.Context(), &body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, body)
}

func (h *TenantConfigHandler) logo(c *gin.Context) {
	cfg, err := h.svc.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if cfg == nil || cfg.LogoPath == nil || *cfg.LogoPath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "logo not configured"})
		return
	}
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.File(*cfg.LogoPath)
}
