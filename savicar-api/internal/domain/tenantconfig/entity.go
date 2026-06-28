package tenantconfig

type TenantConfig struct {
	IDTenant     int     `json:"id_tenant"`
	Name         string  `json:"name"`
	SendWpp      int     `json:"send_wpp"`
	LogoPath     *string `json:"logo_path"`
	BaseURLWhats *string `json:"base_url_whats"`
	ZipCode        *string `json:"zip_code"`
	IDCity         *int    `json:"id_city"`
	Address        *string `json:"address"`
	TaxID          *string `json:"tax_id"`
	ExhibitionName *string `json:"exhibition_name"`
	Email          *string `json:"email"`
	PhoneNumber    *string `json:"phone_number"`
}
