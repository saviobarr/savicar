package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	appsvc "savicar-api/internal/application/productimage"
	"savicar-api/internal/domain/productimage"
	"savicar-api/internal/domain/serviceorderimage"
)

type ProductImageHandler struct {
	svc          *appsvc.Service
	storage      serviceorderimage.FileStorage
	uploadBasePath string
}

func NewProductImageHandler(svc *appsvc.Service, storage serviceorderimage.FileStorage, uploadBasePath string) *ProductImageHandler {
	return &ProductImageHandler{svc: svc, storage: storage, uploadBasePath: uploadBasePath}
}

func (h *ProductImageHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/product-images")
	g.GET("/product/:id_product", h.getByProductID)
	g.GET("/:id/file", h.serveFile)
	g.POST("", h.create)
	g.DELETE("/:id", h.delete)
}

func (h *ProductImageHandler) getByProductID(c *gin.Context) {
	productID, err := strconv.Atoi(c.Param("id_product"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id_product"})
		return
	}
	images, err := h.svc.GetByProductID(c.Request.Context(), productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if images == nil {
		images = []productimage.ProductImage{}
	}
	c.JSON(http.StatusOK, images)
}

func (h *ProductImageHandler) serveFile(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	img, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if img.ImagePath == nil || *img.ImagePath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no image file"})
		return
	}
	c.File(*img.ImagePath)
}

func (h *ProductImageHandler) create(c *gin.Context) {
	var img productimage.ProductImage

	if raw := c.PostForm("id_product"); raw != "" {
		id, err := strconv.Atoi(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id_product"})
			return
		}
		img.IDProduct = &id
	}

	imageFile, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image file required"})
		return
	}
	path, err := h.storage.Save(imageFile, "product-img")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save image: " + err.Error()})
		return
	}
	img.ImagePath = &path

	if err := h.svc.Create(c.Request.Context(), &img); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, img)
}

func (h *ProductImageHandler) delete(c *gin.Context) {
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

