package costcategory

type CostCategory struct {
	IDCostCategory int     `json:"id_cost_category"`
	Name           *string `json:"name"`
	Type           *int    `json:"type"`
	Description    *string `json:"description"`
}
