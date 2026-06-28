package financialreport

type TechnicianCostItem struct {
	TechnicianName string  `json:"technician_name"`
	Cost           float64 `json:"cost"`
}

type OrderResult struct {
	IDOrder              int                  `json:"id_order"`
	CustomerName         string               `json:"customer_name"`
	ServiceIncome        float64              `json:"service_income"`
	ProductIncome        float64              `json:"product_income"`
	ProductCost          float64              `json:"product_cost"`
	TechnicianCost       float64              `json:"technician_cost"`
	TechnicianBreakdown  []TechnicianCostItem `json:"technician_breakdown"`
	TotalIncome          float64              `json:"total_income"`
	TotalCost            float64              `json:"total_cost"`
	Result               float64              `json:"result"`
}

type DailyReport struct {
	Date        string        `json:"date"`
	Orders      []OrderResult `json:"orders"`
	TotalIncome float64       `json:"total_income"`
	TotalCost   float64       `json:"total_cost"`
	Result      float64       `json:"result"`
}
