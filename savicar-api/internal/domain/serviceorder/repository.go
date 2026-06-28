package serviceorder

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]ServiceOrder, error)
	FindByID(ctx context.Context, id int) (*ServiceOrder, error)
	Create(ctx context.Context, so *ServiceOrder) error
	Update(ctx context.Context, so *ServiceOrder) error
	Delete(ctx context.Context, id int) error
}
