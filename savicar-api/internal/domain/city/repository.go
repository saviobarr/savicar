package city

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]City, error)
	FindByID(ctx context.Context, id int) (*City, error)
	Create(ctx context.Context, c *City) error
	Update(ctx context.Context, c *City) error
	Delete(ctx context.Context, id int) error
}
