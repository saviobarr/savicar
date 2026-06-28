package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	techniciansvc "savicar-api/internal/application/technician"
	"savicar-api/internal/domain/technician"
)

type TechnicianHandler struct {
	svc *techniciansvc.Service
}

func NewTechnicianHandler(svc *techniciansvc.Service) *TechnicianHandler {
	return &TechnicianHandler{svc: svc}
}

func (h *TechnicianHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/technicians")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all technicians
// @Tags        technicians
// @Produce     json
// @Success     200 {array}  technician.Technician
// @Failure     500 {object} map[string]string
// @Router      /technicians [get]
func (h *TechnicianHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a technician by ID
// @Tags        technicians
// @Produce     json
// @Param       id  path     int true "Technician ID"
// @Success     200 {object} technician.Technician
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /technicians/{id} [get]
func (h *TechnicianHandler) getByID(c *gin.Context) {
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

// @Summary     Create a technician
// @Tags        technicians
// @Accept      json
// @Produce     json
// @Param       body body     technician.Technician true "Payload"
// @Success     201  {object} technician.Technician
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /technicians [post]
func (h *TechnicianHandler) create(c *gin.Context) {
	var item technician.Technician
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

// @Summary     Update a technician
// @Tags        technicians
// @Accept      json
// @Produce     json
// @Param       id   path     int                   true "Technician ID"
// @Param       body body     technician.Technician true "Payload"
// @Success     200  {object} technician.Technician
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /technicians/{id} [put]
func (h *TechnicianHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item technician.Technician
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDTechnician = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a technician
// @Tags        technicians
// @Param       id  path int true "Technician ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /technicians/{id} [delete]
func (h *TechnicianHandler) delete(c *gin.Context) {
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

