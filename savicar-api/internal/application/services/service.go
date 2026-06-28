package services

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/services"
)

type Service struct{ repo services.Repository }

func NewService(repo services.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]services.Service, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*services.Service, error) {
	svc, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if svc == nil {
		return nil, fmt.Errorf("service %d not found", id)
	}
	return svc, nil
}

func (s *Service) Create(ctx context.Context, svc *services.Service) error {
	return s.repo.Create(ctx, svc)
}

func (s *Service) Update(ctx context.Context, svc *services.Service) error {
	return s.repo.Update(ctx, svc)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

