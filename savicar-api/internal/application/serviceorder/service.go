package serviceorder

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/serviceorder"
)

type Service struct{ repo serviceorder.Repository }

func NewService(repo serviceorder.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]serviceorder.ServiceOrder, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*serviceorder.ServiceOrder, error) {
	so, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if so == nil {
		return nil, fmt.Errorf("service order %d not found", id)
	}
	return so, nil
}

func (s *Service) Create(ctx context.Context, so *serviceorder.ServiceOrder) error {
	return s.repo.Create(ctx, so)
}

func (s *Service) Update(ctx context.Context, so *serviceorder.ServiceOrder) error {
	return s.repo.Update(ctx, so)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

