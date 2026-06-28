package paymentmethod

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]PaymentMethod, error)
}
