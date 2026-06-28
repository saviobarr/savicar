package handler

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"

	appsvc "savicar-api/internal/application/serviceorderimage"
	"savicar-api/internal/domain/serviceorderimage"
)

type ServiceOrderImageHandler struct {
	svc          *appsvc.Service
	storage      serviceorderimage.FileStorage
	uploadBasePath string
}

func NewServiceOrderImageHandler(svc *appsvc.Service, storage serviceorderimage.FileStorage, uploadBasePath string) *ServiceOrderImageHandler {
	return &ServiceOrderImageHandler{svc: svc, storage: storage, uploadBasePath: uploadBasePath}
}

func (h *ServiceOrderImageHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/service-order-images")
	g.GET("", h.getAll)
	g.GET("/order/:id_order", h.getByOrderID)
	g.GET("/order/:id_order/image", h.getImageByOrderID)
	g.GET("/:id/file", h.serveImageFile)
	g.GET("/:id", h.getByID)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

// @Summary     List all service order images
// @Tags        service-order-images
// @Produce     json
// @Success     200 {array}  serviceorderimage.ServiceOrderImage
// @Failure     500 {object} map[string]string
// @Router      /service-order-images [get]
func (h *ServiceOrderImageHandler) getAll(c *gin.Context) {
	images, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, images)
}

// @Summary     Serve image file by image ID
// @Tags        service-order-images
// @Produce     octet-stream
// @Param       id path int true "Image ID"
// @Success     200 {file} binary
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /service-order-images/{id}/file [get]
func (h *ServiceOrderImageHandler) serveImageFile(c *gin.Context) {
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
		c.JSON(http.StatusNotFound, gin.H{"error": "no image path for this record"})
		return
	}
	c.File(*img.ImagePath)
}

// @Summary     Get a service order image by ID
// @Tags        service-order-images
// @Produce     json
// @Param       id  path     int true "Image ID"
// @Success     200 {object} serviceorderimage.ServiceOrderImage
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Router      /service-order-images/{id} [get]
func (h *ServiceOrderImageHandler) getByID(c *gin.Context) {
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
	c.JSON(http.StatusOK, img)
}

// @Summary     Create a service order image
// @Tags        service-order-images
// @Accept      mpfd
// @Produce     json
// @Param       id_order  formData int    false "Service Order ID"
// @Param       image     formData file  false "Image file"
// @Param       video     formData file  false "Video file"
// @Success     201 {object} serviceorderimage.ServiceOrderImage
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /service-order-images [post]
func (h *ServiceOrderImageHandler) create(c *gin.Context) {
	var img serviceorderimage.ServiceOrderImage

	if raw := c.PostForm("id_order"); raw != "" {
		id, err := strconv.Atoi(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id_order"})
			return
		}
		img.IDOrder = &id
	}

	if imageFile, err := c.FormFile("image"); err == nil {
		path, err := h.storage.Save(imageFile, "img")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "save image: " + err.Error()})
			return
		}
		img.ImagePath = &path
	}

	if videoFile, err := c.FormFile("video"); err == nil {
		path, err := h.storage.Save(videoFile, "vid")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "save video: " + err.Error()})
			return
		}
		img.VideoPath = &path
	}

	if err := h.svc.Create(c.Request.Context(), &img); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, img)
}

// @Summary     List images metadata for an order
// @Tags        service-order-images
// @Produce     json
// @Param       id_order path int true "Service Order ID"
// @Success     200 {array}  serviceorderimage.ServiceOrderImage
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /service-order-images/order/{id_order} [get]
func (h *ServiceOrderImageHandler) getByOrderID(c *gin.Context) {
	orderID, err := strconv.Atoi(c.Param("id_order"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id_order"})
		return
	}

	images, err := h.svc.GetByOrderID(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type item struct {
		IDImage   int     `json:"id_image"`
		IDOrder   *int    `json:"id_order"`
		ImagePath *string `json:"image_path"`
	}

	result := make([]item, len(images))
	for i, img := range images {
		result[i] = item{
			IDImage:   img.IDImage,
			IDOrder:   img.IDOrder,
			ImagePath: img.ImagePath,
		}
	}

	c.JSON(http.StatusOK, result)
}

// @Summary     Get all images for an order as a ZIP
// @Tags        service-order-images
// @Produce     application/zip
// @Param       id_order path int true "Service Order ID"
// @Success     200 {file} binary
// @Failure     400 {object} map[string]string
// @Failure     404 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /service-order-images/order/{id_order}/image [get]
func (h *ServiceOrderImageHandler) getImageByOrderID(c *gin.Context) {
	orderID, err := strconv.Atoi(c.Param("id_order"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id_order"})
		return
	}

	relPaths, err := h.svc.GetImagePathsByOrderID(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=order_%d_images.zip", orderID))

	zw := zip.NewWriter(c.Writer)
	defer zw.Close()

	// manifest.json â€” list of file paths included in this archive
	manifest, _ := json.MarshalIndent(map[string]any{
		"order_id": orderID,
		"paths":    relPaths,
	}, "", "  ")
	mf, err := zw.Create("manifest.json")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "zip manifest: " + err.Error()})
		return
	}
	mf.Write(manifest)

	for _, absPath := range relPaths {
		data, err := os.ReadFile(absPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "read file: " + err.Error()})
			return
		}
		f, err := zw.Create(filepath.Base(absPath))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "zip entry: " + err.Error()})
			return
		}
		f.Write(data)
	}
}

// @Summary     Update a service order image
// @Tags        service-order-images
// @Accept      json
// @Produce     json
// @Param       id   path     int                                  true "Image ID"
// @Param       body body     serviceorderimage.ServiceOrderImage true "Payload"
// @Success     200  {object} serviceorderimage.ServiceOrderImage
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /service-order-images/{id} [put]
func (h *ServiceOrderImageHandler) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var img serviceorderimage.ServiceOrderImage
	if err := c.ShouldBindJSON(&img); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	img.IDImage = id
	if err := h.svc.Update(c.Request.Context(), &img); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, img)
}

// @Summary     Delete a service order image
// @Tags        service-order-images
// @Param       id  path int true "Image ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /service-order-images/{id} [delete]
func (h *ServiceOrderImageHandler) delete(c *gin.Context) {
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

