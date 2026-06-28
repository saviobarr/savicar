package serviceappointment

type ServiceAppointment struct {
	IDServiceAppointment int     `json:"id_service_appointment"`
	IDCustomerModel      *int    `json:"id_customer_model"`
	StartAt              *string `json:"start_at"`
	EndAt                *string `json:"end_at"`
	Status               *int    `json:"status"`
	Notes                *string `json:"notes"`
	// Derived via JOINs — read-only
	IDCustomer   *int    `json:"id_customer"`
	CustomerName *string `json:"customer_name"`
	ModelName    *string `json:"model_name"`
	PlateNumber  *string `json:"plate_number"`
}
