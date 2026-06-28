package productimage

import "context"

type Repository interface {
	FindByProductID(ctx context.Context, productID int) ([]ProductImage, error)
	FindByID(ctx context.Context, id int) (*ProductImage, error)
	Create(ctx context.Context, img *ProductImage) error
	Delete(ctx context.Context, id int) error
}
