package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	serviceorderproductssvc "savicar-api/internal/application/serviceorderproducts"
	"savicar-api/internal/domain/serviceorderproducts"
)

type ServiceOrderProductsHandler struct {
	svc *serviceorderproductssvc.Service
}

func NewServiceOrderProductsHandler(svc *serviceorderproductssvc.Service) *ServiceOrderProductsHandler {
	return &ServiceOrderProductsHandler{svc: svc}
}

func (h *ServiceOrderProductsHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/service-order-products")
	g.GET("", h.getAll)
	g.GET("/order/:order_id", h.getByOrderID)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all service order products
// @Tags        service-order-products
// @Produce     json
// @Success     200 {array}  serviceorderproducts.ServiceOrderProduct
// @Failure     500 {object} map[string]string
// @Router      /service-order-products [get]
func (h *ServiceOrderProductsHandler) getByOrderID(c *gin.Context) {
	orderID, err := strconv.Atoi(c.Param("order_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order_id"})
		return
	}
	items, err := h.svc.GetByOrderID(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []serviceorderproducts.ServiceOrderProduct{}
	}
	c.JSON(http.StatusOK, items)
}

func (h *ServiceOrderProductsHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a service order product by ID
// @Tags        service-order-products
// @Produce     json
// @Param       id  path     int true "Service Order Product ID"
// @Success     200 {object} serviceorderproducts.ServiceOrderProduct
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /service-order-products/{id} [get]
func (h *ServiceOrderProductsHandler) getByID(c *gin.Context) {
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

// @Summary     Create a service order product
// @Tags        service-order-products
// @Accept      json
// @Produce     json
// @Param       body body     serviceorderproducts.ServiceOrderProduct true "Payload"
// @Success     201  {object} serviceorderproducts.ServiceOrderProduct
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /service-order-products [post]
func (h *ServiceOrderProductsHandler) create(c *gin.Context) {
	var item serviceorderproducts.ServiceOrderProduct
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

// @Summary     Update a service order product
// @Tags        service-order-products
// @Accept      json
// @Produce     json
// @Param       id   path     int                                       true "Service Order Product ID"
// @Param       body body     serviceorderproducts.ServiceOrderProduct  true "Payload"
// @Success     200  {object} serviceorderproducts.ServiceOrderProduct
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /service-order-products/{id} [put]
func (h *ServiceOrderProductsHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item serviceorderproducts.ServiceOrderProduct
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDServiceOrderProduct = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a service order product
// @Tags        service-order-products
// @Param       id  path int true "Service Order Product ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /service-order-products/{id} [delete]
func (h *ServiceOrderProductsHandler) delete(c *gin.Context) {
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

