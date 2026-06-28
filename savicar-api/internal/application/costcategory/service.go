package costcategory

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/costcategory"
)

type Service struct{ repo costcategory.Repository }

func NewService(repo costcategory.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]costcategory.CostCategory, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*costcategory.CostCategory, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, fmt.Errorf("cost category %d not found", id)
	}
	return c, nil
}

func (s *Service) Create(ctx context.Context, c *costcategory.CostCategory) error {
	return s.repo.Create(ctx, c)
}

func (s *Service) Update(ctx context.Context, c *costcategory.CostCategory) error {
	return s.repo.Update(ctx, c)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

