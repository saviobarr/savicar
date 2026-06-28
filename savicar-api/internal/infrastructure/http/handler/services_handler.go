package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	servicessvc "savicar-api/internal/application/services"
	"savicar-api/internal/domain/services"
)

type ServicesHandler struct {
	svc *servicessvc.Service
}

func NewServicesHandler(svc *servicessvc.Service) *ServicesHandler {
	return &ServicesHandler{svc: svc}
}

func (h *ServicesHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/services")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all services
// @Tags        services
// @Produce     json
// @Success     200 {array}  services.Service
// @Failure     500 {object} map[string]string
// @Router      /services [get]
func (h *ServicesHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a service by ID
// @Tags        services
// @Produce     json
// @Param       id  path     int true "Service ID"
// @Success     200 {object} services.Service
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /services/{id} [get]
func (h *ServicesHandler) getByID(c *gin.Context) {
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

// @Summary     Create a service
// @Tags        services
// @Accept      json
// @Produce     json
// @Param       body body     services.Service true "Payload"
// @Success     201  {object} services.Service
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /services [post]
func (h *ServicesHandler) create(c *gin.Context) {
	var item services.Service
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

// @Summary     Update a service
// @Tags        services
// @Accept      json
// @Produce     json
// @Param       id   path     int              true "Service ID"
// @Param       body body     services.Service true "Payload"
// @Success     200  {object} services.Service
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /services/{id} [put]
func (h *ServicesHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item services.Service
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDService = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a service
// @Tags        services
// @Param       id  path int true "Service ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /services/{id} [delete]
func (h *ServicesHandler) delete(c *gin.Context) {
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

