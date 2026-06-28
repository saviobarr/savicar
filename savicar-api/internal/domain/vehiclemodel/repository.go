package vehiclemodel

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]VehicleModel, error)
	FindByID(ctx context.Context, id int) (*VehicleModel, error)
	Create(ctx context.Context, m *VehicleModel) error
	Update(ctx context.Context, m *VehicleModel) error
	Delete(ctx context.Context, id int) error
}
