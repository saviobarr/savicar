package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	appnfse "savicar-api/internal/application/nfse"
)

type NfseHandler struct {
	svc *appnfse.Service
}

func NewNfseHandler(svc *appnfse.Service) *NfseHandler {
	return &NfseHandler{svc: svc}
}

func (h *NfseHandler) RegisterRoutes(r gin.IRouter) {
	r.POST("/nfse/emitir", h.emitir)
	r.GET("/nfse/emitir/:ref", h.consultar)
	r.POST("/nfse/preview", h.preview)
}

func withRef(ref string, statusCode int, body []byte) gin.H {
	out := gin.H{"ref": ref, "focus_status_code": statusCode}
	var parsed any
	if len(body) > 0 && json.Unmarshal(body, &parsed) == nil {
		out["focus_response"] = parsed
	} else {
		out["focus_response_raw"] = string(body)
	}
	return out
}

// emitir submits the DPS (the JSON built by the NFS-e screen) to Focus NFe
// and polls its status for a while before responding — see
// application/nfse.Service.EmitirNFSe.
func (h *NfseHandler) emitir(c *gin.Context) {
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	ref, status, body, err := h.svc.EmitirNFSe(c.Request.Context(), payload)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "ref": ref})
		return
	}
	c.JSON(http.StatusOK, withRef(ref, status, body))
}

// preview renders a draft DANFSe PDF from the DPS currently on the NFS-e
// screen, without submitting anything to Focus NFe.
func (h *NfseHandler) preview(c *gin.Context) {
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	pdfBytes, err := h.svc.PreviewPdf(c.Request.Context(), payload)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// consultar re-checks the status of a DPS already submitted via emitir,
// identified by the reference returned back then.
func (h *NfseHandler) consultar(c *gin.Context) {
	ref := c.Param("ref")
	status, body, err := h.svc.ConsultarNFSe(c.Request.Context(), ref)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "ref": ref})
		return
	}
	c.JSON(http.StatusOK, withRef(ref, status, body))
}
