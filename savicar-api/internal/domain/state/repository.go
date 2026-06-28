package state

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]State, error)
	FindByID(ctx context.Context, id int) (*State, error)
	Create(ctx context.Context, s *State) error
	Update(ctx context.Context, s *State) error
	Delete(ctx context.Context, id int) error
}
