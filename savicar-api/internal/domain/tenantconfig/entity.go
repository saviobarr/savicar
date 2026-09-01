package tenantconfig

type TenantConfig struct {
	IDTenant             int      `json:"id_tenant"`
	Name                 string   `json:"name"`
	SendWpp              int      `json:"send_wpp"`
	LogoPath             *string  `json:"logo_path"`
	BaseURLWhats         *string  `json:"base_url_whats"`
	ZipCode              *string  `json:"zip_code"`
	IDCity               *int     `json:"id_city"`
	Address              *string  `json:"address"`
	TaxID                *string  `json:"tax_id"`
	ExhibitionName       *string  `json:"exhibition_name"`
	Email                *string  `json:"email"`
	PhoneNumber          *string  `json:"phone_number"`
	ApiKeyNf             *string  `json:"api_key_nf"`
	IssPercent           *float64 `json:"iss_percent"`
	ServiceCode          *string  `json:"service_code"`
	SerieInvoice         *string  `json:"serie_invoice"`
	CityServiceCode      *string  `json:"city_service_code"`
	FederalServiceCode   *string  `json:"federal_service_code"`
	MunicipalID          *string  `json:"municipal_id"`
	OptCodeSimples       *int     `json:"opt_code_simples"`
	RegimeTribSimplesNac *int     `json:"regime_trib_simples_nac"`
	RegimeEspTributacao  *int     `json:"regime_esp_tributacao"`
	CodigoTribNacIss     *string  `json:"codigo_trib_nac_iss"`
	TributacaoIss        *int     `json:"tributacao_iss"`
	TpIssRetention       *int     `json:"tp_iss_retention"`
	PercentFederalTax    *float64 `json:"percent_federal_tax"`
	PercentStateTax      *float64 `json:"percent_state_tax"`
	PercentMunicipalTax  *float64 `json:"percent_municipal_tax"`
}
