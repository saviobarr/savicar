package customer

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Customer, error)
	FindByID(ctx context.Context, id int) (*Customer, error)
	Create(ctx context.Context, c *Customer) error
	Update(ctx context.Context, c *Customer) error
	Delete(ctx context.Context, id int) error
}
