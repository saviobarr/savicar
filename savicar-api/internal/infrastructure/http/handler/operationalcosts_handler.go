package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	appoperationalcosts "savicar-api/internal/application/operationalcosts"
	"savicar-api/internal/domain/operationalcosts"
)

type OperationalCostsHandler struct {
	svc *appoperationalcosts.Service
}

func NewOperationalCostsHandler(svc *appoperationalcosts.Service) *OperationalCostsHandler {
	return &OperationalCostsHandler{svc: svc}
}

func (h *OperationalCostsHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/operational-costs")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all operational costs
// @Tags        operational-costs
// @Produce     json
// @Success     200 {array}  operationalcosts.OperationalCost
// @Failure     500 {object} map[string]string
// @Router      /operational-costs [get]
func (h *OperationalCostsHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get an operational cost by ID
// @Tags        operational-costs
// @Produce     json
// @Param       id  path     int true "Operational Cost ID"
// @Success     200 {object} operationalcosts.OperationalCost
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /operational-costs/{id} [get]
func (h *OperationalCostsHandler) getByID(c *gin.Context) {
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

// @Summary     Create an operational cost
// @Tags        operational-costs
// @Accept      json
// @Produce     json
// @Param       body body     operationalcosts.OperationalCost true "Payload"
// @Success     201  {object} operationalcosts.OperationalCost
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /operational-costs [post]
func (h *OperationalCostsHandler) create(c *gin.Context) {
	var item operationalcosts.OperationalCost
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

// @Summary     Update an operational cost
// @Tags        operational-costs
// @Accept      json
// @Produce     json
// @Param       id   path     int                              true "Operational Cost ID"
// @Param       body body     operationalcosts.OperationalCost true "Payload"
// @Success     200  {object} operationalcosts.OperationalCost
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /operational-costs/{id} [put]
func (h *OperationalCostsHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item operationalcosts.OperationalCost
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDCost = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete an operational cost
// @Tags        operational-costs
// @Param       id  path int true "Operational Cost ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /operational-costs/{id} [delete]
func (h *OperationalCostsHandler) delete(c *gin.Context) {
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

