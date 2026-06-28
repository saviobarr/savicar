package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	paymentmethodsvc "savicar-api/internal/application/paymentmethod"
)

type PaymentMethodHandler struct {
	svc *paymentmethodsvc.Service
}

func NewPaymentMethodHandler(svc *paymentmethodsvc.Service) *PaymentMethodHandler {
	return &PaymentMethodHandler{svc: svc}
}

func (h *PaymentMethodHandler) RegisterRoutes(r gin.IRouter) {
	r.GET("/payment-methods", h.getAll)
}

func (h *PaymentMethodHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

