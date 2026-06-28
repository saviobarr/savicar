package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	contactsvc "savicar-api/internal/application/contact"
	"savicar-api/internal/domain/contact"
)

type ContactHandler struct {
	svc *contactsvc.Service
}

func NewContactHandler(svc *contactsvc.Service) *ContactHandler {
	return &ContactHandler{svc: svc}
}

func (h *ContactHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/contacts")
	g.GET("", h.getAll)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all contacts
// @Tags        contacts
// @Produce     json
// @Success     200 {array}  contact.Contact
// @Failure     500 {object} map[string]string
// @Router      /contacts [get]
func (h *ContactHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a contact by ID
// @Tags        contacts
// @Produce     json
// @Param       id  path     int true "Contact ID"
// @Success     200 {object} contact.Contact
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /contacts/{id} [get]
func (h *ContactHandler) getByID(c *gin.Context) {
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

// @Summary     Create a contact
// @Tags        contacts
// @Accept      json
// @Produce     json
// @Param       body body     contact.Contact true "Payload"
// @Success     201  {object} contact.Contact
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /contacts [post]
func (h *ContactHandler) create(c *gin.Context) {
	var item contact.Contact
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

// @Summary     Update a contact
// @Tags        contacts
// @Accept      json
// @Produce     json
// @Param       id   path     int             true "Contact ID"
// @Param       body body     contact.Contact true "Payload"
// @Success     200  {object} contact.Contact
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /contacts/{id} [put]
func (h *ContactHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item contact.Contact
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDContact = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a contact
// @Tags        contacts
// @Param       id  path int true "Contact ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /contacts/{id} [delete]
func (h *ContactHandler) delete(c *gin.Context) {
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

