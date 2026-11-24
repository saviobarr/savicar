package serviceorderproducts

type ServiceOrderProduct struct {
	IDServiceOrderProduct int      `json:"id_service_order_product"`
	IDOrder               *int     `json:"id_order"`
	IDProduct             *int     `json:"id_product"`
	Quantity              *float64 `json:"quantity"`
	CostPrice             *float64 `json:"cost_price"`
	SalesPrice            *float64 `json:"sales_price"`
	ProductName           *string  `json:"product_name,omitempty"`
}
