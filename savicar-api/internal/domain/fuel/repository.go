package fuel

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Fuel, error)
	FindByID(ctx context.Context, id int) (*Fuel, error)
	Create(ctx context.Context, f *Fuel) error
	Update(ctx context.Context, f *Fuel) error
	Delete(ctx context.Context, id int) error
}
