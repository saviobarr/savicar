package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	appcostcategory "savicar-api/internal/application/costcategory"
	"savicar-api/internal/domain/costcategory"
)

type CostCategoryHandler struct {
	svc *appcostcategory.Service
}

func NewCostCategoryHandler(svc *appcostcategory.Service) *CostCategoryHandler {
	return &CostCategoryHandler{svc: svc}
}

func (h *CostCategoryHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/cost-categories")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all cost categories
// @Tags        cost-categories
// @Produce     json
// @Success     200 {array}  costcategory.CostCategory
// @Failure     500 {object} map[string]string
// @Router      /cost-categories [get]
func (h *CostCategoryHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a cost category by ID
// @Tags        cost-categories
// @Produce     json
// @Param       id  path     int true "Cost Category ID"
// @Success     200 {object} costcategory.CostCategory
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /cost-categories/{id} [get]
func (h *CostCategoryHandler) getByID(c *gin.Context) {
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

// @Summary     Create a cost category
// @Tags        cost-categories
// @Accept      json
// @Produce     json
// @Param       body body     costcategory.CostCategory true "Payload"
// @Success     201  {object} costcategory.CostCategory
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /cost-categories [post]
func (h *CostCategoryHandler) create(c *gin.Context) {
	var item costcategory.CostCategory
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

// @Summary     Update a cost category
// @Tags        cost-categories
// @Accept      json
// @Produce     json
// @Param       id   path     int                       true "Cost Category ID"
// @Param       body body     costcategory.CostCategory true "Payload"
// @Success     200  {object} costcategory.CostCategory
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /cost-categories/{id} [put]
func (h *CostCategoryHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item costcategory.CostCategory
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDCostCategory = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a cost category
// @Tags        cost-categories
// @Param       id  path int true "Cost Category ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /cost-categories/{id} [delete]
func (h *CostCategoryHandler) delete(c *gin.Context) {
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

