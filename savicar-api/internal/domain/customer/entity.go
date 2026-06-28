package customer

type Customer struct {
	IDCustomer             int     `json:"id_customer"`
	IsLegalPerson          *bool   `json:"is_legal_person"`
	IsActive               *bool   `json:"is_active"`
	LegalName              *string `json:"legal_name"`
	TradeName              *string `json:"trade_name"`
	IndividualName         *string `json:"individual_name"`
	DOB                    *string `json:"dob"`
	Gender                 *int    `json:"gender"`
	TaxID                  *string `json:"tax_id"`
	WebSite                *string `json:"web_site"`
	StateRegistration      *string `json:"state_registration"`
	MunicipalRegistration  *string `json:"municipal_registration"`
	ImagePath              *string `json:"image_path"`
}
