package payment

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Payment, error)
	FindByID(ctx context.Context, id int) (*Payment, error)
	FindByOrderID(ctx context.Context, orderID int) ([]Payment, error)
	Create(ctx context.Context, p *Payment) error
	Update(ctx context.Context, p *Payment) error
	Delete(ctx context.Context, id int) error
}
