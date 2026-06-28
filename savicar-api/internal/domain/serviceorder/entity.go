package serviceorder

type ServiceOrder struct {
	IDOrder         int     `json:"id_order"`
	ServiceType     *int    `json:"service_type"`
	IDCustomerModel *int    `json:"id_customer_model"`
	DateTimeIn      *string `json:"date_time_in"`
	DateTimeOut     *string `json:"date_time_out"`
	PlateNumber     *string `json:"plate_number"`
	VIN             *string `json:"vin"`
	CustomerNotes   *string `json:"customer_notes"`
	InternalNotes   *string `json:"internal_notes"`
	IDCustomer      *int    `json:"id_customer"`
	DiagnosisNotes  *string `json:"diagnosis_notes"`
	OdometerReading *int     `json:"odometer_reading"`
	IDTechnician    *int     `json:"id_technician"`
	TechnicianName  *string  `json:"technician_name"`
	CustomerName    *string  `json:"customer_name"`
	CustomerPhone   *string  `json:"customer_phone"`
	ModelName       *string  `json:"model_name"`
	TotalAmount     *float64 `json:"total_amount"`
	Discount        *float64 `json:"discount"`
	FinalAmount     *float64 `json:"final_amount"`
	Status          *int     `json:"status"`
}
