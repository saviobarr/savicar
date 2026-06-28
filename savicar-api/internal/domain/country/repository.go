package country

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Country, error)
	FindByID(ctx context.Context, id int) (*Country, error)
	Create(ctx context.Context, c *Country) error
	Update(ctx context.Context, c *Country) error
	Delete(ctx context.Context, id int) error
}
