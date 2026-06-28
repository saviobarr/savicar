package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	customersvc "savicar-api/internal/application/customer"
	"savicar-api/internal/domain/customer"
)

type CustomerHandler struct {
	svc *customersvc.Service
}

func NewCustomerHandler(svc *customersvc.Service) *CustomerHandler {
	return &CustomerHandler{svc: svc}
}

func (h *CustomerHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/customers")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all customers
// @Tags        customers
// @Produce     json
// @Success     200 {array}  customer.Customer
// @Failure     500 {object} map[string]string
// @Router      /customers [get]
func (h *CustomerHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a customer by ID
// @Tags        customers
// @Produce     json
// @Param       id  path     int true "Customer ID"
// @Success     200 {object} customer.Customer
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /customers/{id} [get]
func (h *CustomerHandler) getByID(c *gin.Context) {
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

// @Summary     Create a customer
// @Tags        customers
// @Accept      json
// @Produce     json
// @Param       body body     customer.Customer true "Payload"
// @Success     201  {object} customer.Customer
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /customers [post]
func (h *CustomerHandler) create(c *gin.Context) {
	var item customer.Customer
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

// @Summary     Update a customer
// @Tags        customers
// @Accept      json
// @Produce     json
// @Param       id   path     int               true "Customer ID"
// @Param       body body     customer.Customer true "Payload"
// @Success     200  {object} customer.Customer
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /customers/{id} [put]
func (h *CustomerHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item customer.Customer
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDCustomer = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a customer
// @Tags        customers
// @Param       id  path int true "Customer ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /customers/{id} [delete]
func (h *CustomerHandler) delete(c *gin.Context) {
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

