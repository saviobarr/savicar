package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	nfsvc "savicar-api/internal/application/nf"
	"savicar-api/internal/domain/nf"
)

type NFHandler struct {
	svc *nfsvc.Service
}

func NewNFHandler(svc *nfsvc.Service) *NFHandler {
	return &NFHandler{svc: svc}
}

func (h *NFHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/nf")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all notas fiscais
// @Tags        nf
// @Produce     json
// @Success     200 {array}  nf.NF
// @Failure     500 {object} map[string]string
// @Router      /nf [get]
func (h *NFHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a nota fiscal by ID
// @Tags        nf
// @Produce     json
// @Param       id  path     int true "NF ID"
// @Success     200 {object} nf.NF
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /nf/{id} [get]
func (h *NFHandler) getByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	item, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Create a nota fiscal
// @Tags        nf
// @Accept      json
// @Produce     json
// @Param       body body     nf.NF true "Payload"
// @Success     201  {object} nf.NF
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /nf [post]
func (h *NFHandler) create(c *gin.Context) {
	var item nf.NF
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if err := h.svc.Create(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

// @Summary     Update a nota fiscal
// @Tags        nf
// @Accept      json
// @Produce     json
// @Param       id   path     int    true "NF ID"
// @Param       body body     nf.NF  true "Payload"
// @Success     200  {object} nf.NF
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /nf/{id} [put]
func (h *NFHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item nf.NF
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.Numero = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a nota fiscal
// @Tags        nf
// @Param       id  path int true "NF ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /nf/{id} [delete]
func (h *NFHandler) delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
