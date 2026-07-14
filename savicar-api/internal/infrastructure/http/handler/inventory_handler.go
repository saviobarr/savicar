package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	inventorysvc "savicar-api/internal/application/inventory"
	"savicar-api/internal/domain/inventory"
)

type InventoryHandler struct {
	svc *inventorysvc.Service
}

func NewInventoryHandler(svc *inventorysvc.Service) *InventoryHandler {
	return &InventoryHandler{svc: svc}
}

func (h *InventoryHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/inventory")
	g.GET("", h.getAll)
	g.GET("/barcode/:code", h.getByBarcode)
	g.GET("/external-lookup/:code", h.getExternalLookup)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
	g.POST("/:id/adjust", h.adjustQuantity)
}

// @Summary     List all inventory products
// @Tags        inventory
// @Produce     json
// @Success     200 {array}  inventory.Inventory
// @Failure     500 {object} map[string]string
// @Router      /inventory [get]
func (h *InventoryHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get an inventory product by ID
// @Tags        inventory
// @Produce     json
// @Param       id  path     int true "Product ID"
// @Success     200 {object} inventory.Inventory
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /inventory/{id} [get]
func (h *InventoryHandler) getByID(c *gin.Context) {
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

// @Summary     Get an inventory product by barcode (GTIN/EAN)
// @Tags        inventory
// @Produce     json
// @Param       code path     string true "GTIN/EAN barcode"
// @Success     200  {object} inventory.Inventory
// @Failure     404  {object} map[string]string
// @Router      /inventory/barcode/{code} [get]
func (h *InventoryHandler) getByBarcode(c *gin.Context) {
	code := c.Param("code")
	item, err := h.svc.GetByBarcode(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Look up basic product info by barcode in an external product database
// @Description Used when the barcode isn't found in the local inventory, to help pre-fill a new product's registration.
// @Tags        inventory
// @Produce     json
// @Param       code path     string true "GTIN/EAN barcode"
// @Success     200  {object} inventory.ExternalProduct
// @Failure     404  {object} map[string]string
// @Router      /inventory/external-lookup/{code} [get]
func (h *InventoryHandler) getExternalLookup(c *gin.Context) {
	code := c.Param("code")
	product, err := h.svc.LookupExternal(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, product)
}

// @Summary     Create an inventory product
// @Tags        inventory
// @Accept      json
// @Produce     json
// @Param       body body     inventory.Inventory true "Payload"
// @Success     201  {object} inventory.Inventory
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /inventory [post]
func (h *InventoryHandler) create(c *gin.Context) {
	var item inventory.Inventory
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

// @Summary     Update an inventory product
// @Tags        inventory
// @Accept      json
// @Produce     json
// @Param       id   path     int                 true "Product ID"
// @Param       body body     inventory.Inventory true "Payload"
// @Success     200  {object} inventory.Inventory
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /inventory/{id} [put]
func (h *InventoryHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item inventory.Inventory
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDProduct = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete an inventory product
// @Tags        inventory
// @Param       id  path int true "Product ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /inventory/{id} [delete]
func (h *InventoryHandler) delete(c *gin.Context) {
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

// @Summary     Adjust current quantity of an inventory product
// @Tags        inventory
// @Accept      json
// @Produce     json
// @Param       id   path     int                      true "Product ID"
// @Param       body body     map[string]int           true "delta"
// @Success     200  {object} map[string]string
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /inventory/{id}/adjust [post]
func (h *InventoryHandler) adjustQuantity(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var body struct {
		Delta float64 `json:"delta"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if err := h.svc.AdjustQuantity(c.Request.Context(), id, body.Delta); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

