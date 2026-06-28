package resource

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Resource, error)
	FindByID(ctx context.Context, id int) (*Resource, error)
	Create(ctx context.Context, r *Resource) error
	Update(ctx context.Context, r *Resource) error
	Delete(ctx context.Context, id int) error
}
