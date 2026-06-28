package contact

type Contact struct {
	IDContact             int     `json:"id_contact"`
	IDCustomer            *int    `json:"id_customer"`
	MobilePhone           *string `json:"mobile_phone"`
	IsMobilePhoneWhatsapp *bool   `json:"is_mobile_phone_whatsapp"`
	Email                 *string `json:"email"`
	Address               *string `json:"address"`
	IDCity                *int    `json:"id_city"`
	Neighborhood          *string `json:"neighborhood"`
	AddressNumber         *int    `json:"address_number"`
}
