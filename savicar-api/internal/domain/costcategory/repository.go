package costcategory

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]CostCategory, error)
	FindByID(ctx context.Context, id int) (*CostCategory, error)
	Create(ctx context.Context, c *CostCategory) error
	Update(ctx context.Context, c *CostCategory) error
	Delete(ctx context.Context, id int) error
}
