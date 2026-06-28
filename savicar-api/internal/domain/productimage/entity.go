package productimage

type ProductImage struct {
	IDImage   int     `json:"id_image"`
	IDProduct *int    `json:"id_product"`
	ImagePath *string `json:"image_path"`
}
