package serviceorderimage

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]ServiceOrderImage, error)
	FindByID(ctx context.Context, id int) (*ServiceOrderImage, error)
	FindByOrderID(ctx context.Context, orderID int) ([]ServiceOrderImage, error)
	Create(ctx context.Context, img *ServiceOrderImage) error
	Update(ctx context.Context, img *ServiceOrderImage) error
	Delete(ctx context.Context, id int) error
}
