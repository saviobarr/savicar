package state

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/state"
)

type Service struct{ repo state.Repository }

func NewService(repo state.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]state.State, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*state.State, error) {
	st, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, fmt.Errorf("state %d not found", id)
	}
	return st, nil
}

func (s *Service) Create(ctx context.Context, st *state.State) error {
	return s.repo.Create(ctx, st)
}

func (s *Service) Update(ctx context.Context, st *state.State) error {
	return s.repo.Update(ctx, st)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

