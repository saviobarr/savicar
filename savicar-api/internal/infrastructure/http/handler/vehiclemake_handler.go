package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	vehiclemakesvc "savicar-api/internal/application/vehiclemake"
	"savicar-api/internal/domain/vehiclemake"
)

type VehicleMakeHandler struct {
	svc *vehiclemakesvc.Service
}

func NewVehicleMakeHandler(svc *vehiclemakesvc.Service) *VehicleMakeHandler {
	return &VehicleMakeHandler{svc: svc}
}

func (h *VehicleMakeHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/makes")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all vehicle makes
// @Tags        makes
// @Produce     json
// @Success     200 {array}  vehiclemake.VehicleMake
// @Failure     500 {object} map[string]string
// @Router      /makes [get]
func (h *VehicleMakeHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a vehicle make by ID
// @Tags        makes
// @Produce     json
// @Param       id  path     int true "Make ID"
// @Success     200 {object} vehiclemake.VehicleMake
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /makes/{id} [get]
func (h *VehicleMakeHandler) getByID(c *gin.Context) {
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

// @Summary     Create a vehicle make
// @Tags        makes
// @Accept      json
// @Produce     json
// @Param       body body     vehiclemake.VehicleMake true "Payload"
// @Success     201  {object} vehiclemake.VehicleMake
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /makes [post]
func (h *VehicleMakeHandler) create(c *gin.Context) {
	var item vehiclemake.VehicleMake
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

// @Summary     Update a vehicle make
// @Tags        makes
// @Accept      json
// @Produce     json
// @Param       id   path     int                    true "Make ID"
// @Param       body body     vehiclemake.VehicleMake true "Payload"
// @Success     200  {object} vehiclemake.VehicleMake
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /makes/{id} [put]
func (h *VehicleMakeHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item vehiclemake.VehicleMake
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDMake = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a vehicle make
// @Tags        makes
// @Param       id  path int true "Make ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /makes/{id} [delete]
func (h *VehicleMakeHandler) delete(c *gin.Context) {
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

