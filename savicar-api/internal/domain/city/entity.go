package city

type City struct {
	IDCity       int     `json:"id_city"`
	IDState      *int    `json:"id_state"`
	Name         *string `json:"name"`
	Abbreviation *string `json:"abbreviation"`
}
