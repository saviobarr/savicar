package contact

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Contact, error)
	FindByID(ctx context.Context, id int) (*Contact, error)
	Create(ctx context.Context, c *Contact) error
	Update(ctx context.Context, c *Contact) error
	Delete(ctx context.Context, id int) error
}
