package unity

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Unity, error)
	FindByID(ctx context.Context, id int) (*Unity, error)
	Create(ctx context.Context, u *Unity) error
	Update(ctx context.Context, u *Unity) error
	Delete(ctx context.Context, id int) error
}
