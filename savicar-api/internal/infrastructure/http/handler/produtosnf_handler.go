package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	produtosnfsvc "savicar-api/internal/application/produtosnf"
	"savicar-api/internal/domain/produtosnf"
)

type ProdutosNfHandler struct {
	svc *produtosnfsvc.Service
}

func NewProdutosNfHandler(svc *produtosnfsvc.Service) *ProdutosNfHandler {
	return &ProdutosNfHandler{svc: svc}
}

func (h *ProdutosNfHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/produtos-nf")
	g.GET("", h.getAll)
	g.GET("/nf/:nf_id", h.getByNfID)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all produtos da nota fiscal
// @Tags        produtos-nf
// @Produce     json
// @Success     200 {array}  produtosnf.ProdutoNf
// @Failure     500 {object} map[string]string
// @Router      /produtos-nf [get]
func (h *ProdutosNfHandler) getAll(c *gin.Context) {
	items, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     List produtos of a nota fiscal
// @Tags        produtos-nf
// @Produce     json
// @Param       nf_id  path     int true "NF ID"
// @Success     200 {array}  produtosnf.ProdutoNf
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /produtos-nf/nf/{nf_id} [get]
func (h *ProdutosNfHandler) getByNfID(c *gin.Context) {
	nfID, err := strconv.Atoi(c.Param("nf_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid nf_id"})
		return
	}
	items, err := h.svc.GetByNfID(c.Request.Context(), nfID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []produtosnf.ProdutoNf{}
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Get a produto nf by ID
// @Tags        produtos-nf
// @Produce     json
// @Param       id  path     int true "Produto NF ID"
// @Success     200 {object} produtosnf.ProdutoNf
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /produtos-nf/{id} [get]
func (h *ProdutosNfHandler) getByID(c *gin.Context) {
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

// @Summary     Create a produto nf
// @Tags        produtos-nf
// @Accept      json
// @Produce     json
// @Param       body body     produtosnf.ProdutoNf true "Payload"
// @Success     201  {object} produtosnf.ProdutoNf
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /produtos-nf [post]
func (h *ProdutosNfHandler) create(c *gin.Context) {
	var item produtosnf.ProdutoNf
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

// @Summary     Update a produto nf
// @Tags        produtos-nf
// @Accept      json
// @Produce     json
// @Param       id   path     int                   true "Produto NF ID"
// @Param       body body     produtosnf.ProdutoNf  true "Payload"
// @Success     200  {object} produtosnf.ProdutoNf
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /produtos-nf/{id} [put]
func (h *ProdutosNfHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item produtosnf.ProdutoNf
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	item.IDProduto = id
	if err := h.svc.Update(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// @Summary     Delete a produto nf
// @Tags        produtos-nf
// @Param       id  path int true "Produto NF ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /produtos-nf/{id} [delete]
func (h *ProdutosNfHandler) delete(c *gin.Context) {
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
