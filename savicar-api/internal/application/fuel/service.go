package fuel

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/fuel"
)

type Service struct{ repo fuel.Repository }

func NewService(repo fuel.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]fuel.Fuel, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*fuel.Fuel, error) {
	f, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if f == nil {
		return nil, fmt.Errorf("fuel %d not found", id)
	}
	return f, nil
}

func (s *Service) Create(ctx context.Context, f *fuel.Fuel) error {
	return s.repo.Create(ctx, f)
}

func (s *Service) Update(ctx context.Context, f *fuel.Fuel) error {
	return s.repo.Update(ctx, f)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

