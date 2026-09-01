package issuednf

type IssuedNF struct {
	IDNf       string  `json:"id_nf"`
	IssuedDate *string `json:"issued_date"`
	Receiver   *string `json:"receiver"`
}
