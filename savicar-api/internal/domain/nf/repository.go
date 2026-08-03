package nf

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]NF, error)
	FindByID(ctx context.Context, numero int) (*NF, error)
	Create(ctx context.Context, n *NF) error
	Update(ctx context.Context, n *NF) error
	Delete(ctx context.Context, numero int) error
}
