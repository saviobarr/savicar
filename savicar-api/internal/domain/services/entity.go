package services

type Service struct {
	IDService      int      `json:"id_service"`
	Code           *string  `json:"code"`
	Description    *string  `json:"description"`
	HoursQuantity  *float64 `json:"hours_quantity"`
	UnitValue      *float64 `json:"unit_value"`
	TotalValue     *float64 `json:"total_value"`
	IDOrder        *int     `json:"id_order"`
	IDTechnician   *int     `json:"id_technician"`
	TechnicianName *string  `json:"technician_name"`
	Status         *int     `json:"status"`
}
