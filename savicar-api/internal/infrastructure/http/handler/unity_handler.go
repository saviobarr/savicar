package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	unitysvc "savicar-api/internal/application/unity"
	"savicar-api/internal/domain/unity"
)

type UnityHandler struct {
	svc *unitysvc.Service
}

func NewUnityHandler(svc *unitysvc.Service) *UnityHandler {
	return &UnityHandler{svc: svc}
}

func (h *UnityHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/unities")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all unities
// @Tags        unities
// @Produce     json
// @Success     200 {array}  unity.Unity
// @Failure     500 {object} map[string]string
// @Router      /unities [get]
func (h *UnityHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a unity by ID
// @Tags        unities
// @Produce     json
// @Param       id  path     int true "Unity ID"
// @Success     200 {object} unity.Unity
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /unities/{id} [get]
func (h *UnityHandler) getByID(c *gin.Context) {
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

// @Summary     Create a unity
// @Tags        unities
// @Accept      json
// @Produce     json
// @Param       body body     unity.Unity true "Payload"
// @Success     201  {object} unity.Unity
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /unities [post]
func (h *UnityHandler) create(c *gin.Context) {
	var item unity.Unity
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

// @Summary     Update a unity
// @Tags        unities
// @Accept      json
// @Produce     json
// @Param       id   path     int         true "Unity ID"
// @Param       body body     unity.Unity true "Payload"
// @Success     200  {object} unity.Unity
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /unities/{id} [put]
func (h *UnityHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item unity.Unity
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDUnity = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a unity
// @Tags        unities
// @Param       id  path int true "Unity ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /unities/{id} [delete]
func (h *UnityHandler) delete(c *gin.Context) {
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

