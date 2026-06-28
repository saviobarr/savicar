package serviceorderproducts

type ServiceOrderProduct struct {
	IDServiceOrderProduct int     `json:"id_service_order_product"`
	IDOrder               *int    `json:"id_order"`
	IDProduct             *int    `json:"id_product"`
	Quantity              *float64 `json:"quantity"`
	ProductName           *string `json:"product_name,omitempty"`
}
