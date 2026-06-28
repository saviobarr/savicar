package state

type State struct {
	IDState      int     `json:"id_state"`
	IDCountry    *int    `json:"id_country"`
	Name         *string `json:"name"`
	Abbreviation *string `json:"abbreviation"`
}
