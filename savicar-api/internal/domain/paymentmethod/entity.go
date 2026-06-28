package paymentmethod

type PaymentMethod struct {
	IDPaymentMethod int     `json:"id_payment_method"`
	Description     *string `json:"description"`
}
