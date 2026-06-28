package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	serviceordersvc "savicar-api/internal/application/serviceorder"
	"savicar-api/internal/domain/serviceorder"
)

type ServiceOrderHandler struct {
	svc *serviceordersvc.Service
}

func NewServiceOrderHandler(svc *serviceordersvc.Service) *ServiceOrderHandler {
	return &ServiceOrderHandler{svc: svc}
}

func (h *ServiceOrderHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/service-orders")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all service orders
// @Tags        service-orders
// @Produce     json
// @Success     200 {array}  serviceorder.ServiceOrder
// @Failure     500 {object} map[string]string
// @Router      /service-orders [get]
func (h *ServiceOrderHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a service order by ID
// @Tags        service-orders
// @Produce     json
// @Param       id  path     int true "Order ID"
// @Success     200 {object} serviceorder.ServiceOrder
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /service-orders/{id} [get]
func (h *ServiceOrderHandler) getByID(c *gin.Context) {
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

// @Summary     Create a service order
// @Tags        service-orders
// @Accept      json
// @Produce     json
// @Param       body body     serviceorder.ServiceOrder true "Payload"
// @Success     201  {object} serviceorder.ServiceOrder
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /service-orders [post]
func (h *ServiceOrderHandler) create(c *gin.Context) {
	var item serviceorder.ServiceOrder
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

// @Summary     Update a service order
// @Tags        service-orders
// @Accept      json
// @Produce     json
// @Param       id   path     int                       true "Order ID"
// @Param       body body     serviceorder.ServiceOrder true "Payload"
// @Success     200  {object} serviceorder.ServiceOrder
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /service-orders/{id} [put]
func (h *ServiceOrderHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item serviceorder.ServiceOrder
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDOrder = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a service order
// @Tags        service-orders
// @Param       id  path int true "Order ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /service-orders/{id} [delete]
func (h *ServiceOrderHandler) delete(c *gin.Context) {
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

