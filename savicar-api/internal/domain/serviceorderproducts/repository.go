package serviceorderproducts

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]ServiceOrderProduct, error)
	FindByID(ctx context.Context, id int) (*ServiceOrderProduct, error)
	FindByOrderID(ctx context.Context, orderID int) ([]ServiceOrderProduct, error)
	Create(ctx context.Context, sop *ServiceOrderProduct) error
	Update(ctx context.Context, sop *ServiceOrderProduct) error
	Delete(ctx context.Context, id int) error
}
