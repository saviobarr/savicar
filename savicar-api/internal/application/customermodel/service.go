package customermodel

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/customermodel"
)

type Service struct{ repo customermodel.Repository }

func NewService(repo customermodel.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]customermodel.CustomerModel, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*customermodel.CustomerModel, error) {
	cm, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if cm == nil {
		return nil, fmt.Errorf("customer_model %d not found", id)
	}
	return cm, nil
}

func (s *Service) Create(ctx context.Context, cm *customermodel.CustomerModel) error {
	return s.repo.Create(ctx, cm)
}

func (s *Service) Update(ctx context.Context, cm *customermodel.CustomerModel) error {
	return s.repo.Update(ctx, cm)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

