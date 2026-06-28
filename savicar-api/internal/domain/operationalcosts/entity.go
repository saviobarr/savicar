package operationalcosts

type OperationalCost struct {
	IDCost         int      `json:"id_cost"`
	IDCostCategory *int     `json:"id_cost_category"`
	Description    *string  `json:"description"`
	Amount         *float64 `json:"amount"`
	Recurrence     *int     `json:"recurrence"`
	ReferenceDate  *string  `json:"reference_date"`
	DueDay         *int     `json:"due_day"`
	IDOrder        *int     `json:"id_order"`
	CreatedAt      *string  `json:"created_at,omitempty"`
}
