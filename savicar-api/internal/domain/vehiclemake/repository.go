package vehiclemake

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]VehicleMake, error)
	FindByID(ctx context.Context, id int) (*VehicleMake, error)
	Create(ctx context.Context, m *VehicleMake) error
	Update(ctx context.Context, m *VehicleMake) error
	Delete(ctx context.Context, id int) error
}
