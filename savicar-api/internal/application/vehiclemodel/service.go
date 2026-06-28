package vehiclemodel

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/vehiclemodel"
)

type Service struct{ repo vehiclemodel.Repository }

func NewService(repo vehiclemodel.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]vehiclemodel.VehicleModel, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*vehiclemodel.VehicleModel, error) {
	m, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if m == nil {
		return nil, fmt.Errorf("model %d not found", id)
	}
	return m, nil
}

func (s *Service) Create(ctx context.Context, m *vehiclemodel.VehicleModel) error {
	return s.repo.Create(ctx, m)
}

func (s *Service) Update(ctx context.Context, m *vehiclemodel.VehicleModel) error {
	return s.repo.Update(ctx, m)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

