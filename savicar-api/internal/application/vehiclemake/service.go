package vehiclemake

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/vehiclemake"
)

type Service struct{ repo vehiclemake.Repository }

func NewService(repo vehiclemake.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]vehiclemake.VehicleMake, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*vehiclemake.VehicleMake, error) {
	m, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if m == nil {
		return nil, fmt.Errorf("make %d not found", id)
	}
	return m, nil
}

func (s *Service) Create(ctx context.Context, m *vehiclemake.VehicleMake) error {
	return s.repo.Create(ctx, m)
}

func (s *Service) Update(ctx context.Context, m *vehiclemake.VehicleMake) error {
	return s.repo.Update(ctx, m)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

