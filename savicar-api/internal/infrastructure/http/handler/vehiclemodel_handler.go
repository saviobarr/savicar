package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	vehiclemodelsvc "savicar-api/internal/application/vehiclemodel"
	"savicar-api/internal/domain/vehiclemodel"
)

type VehicleModelHandler struct {
	svc *vehiclemodelsvc.Service
}

func NewVehicleModelHandler(svc *vehiclemodelsvc.Service) *VehicleModelHandler {
	return &VehicleModelHandler{svc: svc}
}

func (h *VehicleModelHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/models")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all vehicle models
// @Tags        models
// @Produce     json
// @Success     200 {array}  vehiclemodel.VehicleModel
// @Failure     500 {object} map[string]string
// @Router      /models [get]
func (h *VehicleModelHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a vehicle model by ID
// @Tags        models
// @Produce     json
// @Param       id  path     int true "Model ID"
// @Success     200 {object} vehiclemodel.VehicleModel
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /models/{id} [get]
func (h *VehicleModelHandler) getByID(c *gin.Context) {
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

// @Summary     Create a vehicle model
// @Tags        models
// @Accept      json
// @Produce     json
// @Param       body body     vehiclemodel.VehicleModel true "Payload"
// @Success     201  {object} vehiclemodel.VehicleModel
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /models [post]
func (h *VehicleModelHandler) create(c *gin.Context) {
	var item vehiclemodel.VehicleModel
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

// @Summary     Update a vehicle model
// @Tags        models
// @Accept      json
// @Produce     json
// @Param       id   path     int                       true "Model ID"
// @Param       body body     vehiclemodel.VehicleModel true "Payload"
// @Success     200  {object} vehiclemodel.VehicleModel
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /models/{id} [put]
func (h *VehicleModelHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item vehiclemodel.VehicleModel
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDModel = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a vehicle model
// @Tags        models
// @Param       id  path int true "Model ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /models/{id} [delete]
func (h *VehicleModelHandler) delete(c *gin.Context) {
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

