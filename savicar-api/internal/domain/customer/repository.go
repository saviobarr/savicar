package customer

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Customer, error)
	FindByID(ctx context.Context, id int) (*Customer, error)
	FindByClientUUID(ctx context.Context, clientUUID string) (*Customer, error)
	FindByTaxID(ctx context.Context, taxID string) (*Customer, error)
	Create(ctx context.Context, c *Customer) error
	Update(ctx context.Context, c *Customer) error
	Delete(ctx context.Context, id int) error
}
