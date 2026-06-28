package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	fuelsvc "savicar-api/internal/application/fuel"
	"savicar-api/internal/domain/fuel"
)

type FuelHandler struct {
	svc *fuelsvc.Service
}

func NewFuelHandler(svc *fuelsvc.Service) *FuelHandler {
	return &FuelHandler{svc: svc}
}

func (h *FuelHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/fuels")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all fuels
// @Tags        fuels
// @Produce     json
// @Success     200 {array}  fuel.Fuel
// @Failure     500 {object} map[string]string
// @Router      /fuels [get]
func (h *FuelHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a fuel by ID
// @Tags        fuels
// @Produce     json
// @Param       id  path     int true "Fuel ID"
// @Success     200 {object} fuel.Fuel
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /fuels/{id} [get]
func (h *FuelHandler) getByID(c *gin.Context) {
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

// @Summary     Create a fuel
// @Tags        fuels
// @Accept      json
// @Produce     json
// @Param       body body     fuel.Fuel true "Payload"
// @Success     201  {object} fuel.Fuel
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /fuels [post]
func (h *FuelHandler) create(c *gin.Context) {
	var item fuel.Fuel
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

// @Summary     Update a fuel
// @Tags        fuels
// @Accept      json
// @Produce     json
// @Param       id   path     int       true "Fuel ID"
// @Param       body body     fuel.Fuel true "Payload"
// @Success     200  {object} fuel.Fuel
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /fuels/{id} [put]
func (h *FuelHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item fuel.Fuel
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDFuel = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a fuel
// @Tags        fuels
// @Param       id  path int true "Fuel ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /fuels/{id} [delete]
func (h *FuelHandler) delete(c *gin.Context) {
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

