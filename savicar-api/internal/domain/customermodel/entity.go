package customermodel

type CustomerModel struct {
	IDCustomerModel int     `json:"id_customer_model"`
	IDCustomer      int     `json:"id_customer"`
	IDModel         int     `json:"id_model"`
	ModelName       *string `json:"model_name,omitempty"`
	CustomerName    *string `json:"customer_name,omitempty"`
	Plate           *string `json:"plate"`
	YearMake        *int    `json:"year_make"`
	YearModel       *int    `json:"year_model"`
	Color           *string `json:"color"`
	VIN             *string `json:"vin"`
}
