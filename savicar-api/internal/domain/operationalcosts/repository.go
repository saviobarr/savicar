package operationalcosts

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]OperationalCost, error)
	FindByID(ctx context.Context, id int) (*OperationalCost, error)
	Create(ctx context.Context, c *OperationalCost) error
	Update(ctx context.Context, c *OperationalCost) error
	Delete(ctx context.Context, id int) error
}
