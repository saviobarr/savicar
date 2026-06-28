package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	customermodelsvc "savicar-api/internal/application/customermodel"
	"savicar-api/internal/domain/customermodel"
)

type CustomerModelHandler struct {
	svc *customermodelsvc.Service
}

func NewCustomerModelHandler(svc *customermodelsvc.Service) *CustomerModelHandler {
	return &CustomerModelHandler{svc: svc}
}

func (h *CustomerModelHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/customer-models")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all customer models
// @Tags        customer-models
// @Produce     json
// @Success     200 {array}  customermodel.CustomerModel
// @Failure     500 {object} map[string]string
// @Router      /customer-models [get]
func (h *CustomerModelHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a customer model by ID
// @Tags        customer-models
// @Produce     json
// @Param       id  path     int true "Customer Model ID"
// @Success     200 {object} customermodel.CustomerModel
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /customer-models/{id} [get]
func (h *CustomerModelHandler) getByID(c *gin.Context) {
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

// @Summary     Create a customer model
// @Tags        customer-models
// @Accept      json
// @Produce     json
// @Param       body body     customermodel.CustomerModel true "Payload"
// @Success     201  {object} customermodel.CustomerModel
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /customer-models [post]
func (h *CustomerModelHandler) create(c *gin.Context) {
	var item customermodel.CustomerModel
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

// @Summary     Update a customer model
// @Tags        customer-models
// @Accept      json
// @Produce     json
// @Param       id   path     int                         true "Customer Model ID"
// @Param       body body     customermodel.CustomerModel true "Payload"
// @Success     200  {object} customermodel.CustomerModel
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /customer-models/{id} [put]
func (h *CustomerModelHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item customermodel.CustomerModel
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDCustomerModel = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a customer model
// @Tags        customer-models
// @Param       id  path int true "Customer Model ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /customer-models/{id} [delete]
func (h *CustomerModelHandler) delete(c *gin.Context) {
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

