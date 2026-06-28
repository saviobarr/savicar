package resource

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/resource"
)

type Service struct{ repo resource.Repository }

func NewService(repo resource.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]resource.Resource, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*resource.Resource, error) {
	r, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, fmt.Errorf("resource %d not found", id)
	}
	return r, nil
}

func (s *Service) Create(ctx context.Context, r *resource.Resource) error {
	return s.repo.Create(ctx, r)
}

func (s *Service) Update(ctx context.Context, r *resource.Resource) error {
	return s.repo.Update(ctx, r)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

