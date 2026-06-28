package country

type Country struct {
	IDCountry    int     `json:"id_country"`
	Name         *string `json:"name"`
	Abbreviation *string `json:"abbreviation"`
}
