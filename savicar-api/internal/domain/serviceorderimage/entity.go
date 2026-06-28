package serviceorderimage

type ServiceOrderImage struct {
	IDImage   int     `json:"id_image"`
	IDOrder   *int    `json:"id_order"`
	ImagePath *string `json:"image_path"`
	VideoPath *string `json:"video_path"`
}
