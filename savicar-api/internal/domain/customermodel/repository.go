package customermodel

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]CustomerModel, error)
	FindByID(ctx context.Context, id int) (*CustomerModel, error)
	Create(ctx context.Context, cm *CustomerModel) error
	Update(ctx context.Context, cm *CustomerModel) error
	Delete(ctx context.Context, id int) error
}
