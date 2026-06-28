package payment

type Payment struct {
	IDPayment              int      `json:"id_payment"`
	IDOrder                *int     `json:"id_order"`
	IDPaymentMethod        *int     `json:"id_payment_method"`
	PaymentMethodDesc      *string  `json:"payment_method_description,omitempty"`
	InstallmentsQuantity   *string  `json:"installments_quantity"`
	DueDate                *string  `json:"due_date"`
	PaymentDate            *string  `json:"payment_date"`
	Value                  *float64 `json:"value"`
}
