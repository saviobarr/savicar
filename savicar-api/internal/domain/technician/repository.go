package technician

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Technician, error)
	FindByID(ctx context.Context, id int) (*Technician, error)
	Create(ctx context.Context, t *Technician) error
	Update(ctx context.Context, t *Technician) error
	Delete(ctx context.Context, id int) error
}
