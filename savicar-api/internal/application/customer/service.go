package customer

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/customer"
)

type Service struct{ repo customer.Repository }

func NewService(repo customer.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]customer.Customer, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*customer.Customer, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, fmt.Errorf("customer %d not found", id)
	}
	return c, nil
}

func (s *Service) Create(ctx context.Context, c *customer.Customer) error {
	return s.repo.Create(ctx, c)
}

func (s *Service) Update(ctx context.Context, c *customer.Customer) error {
	return s.repo.Update(ctx, c)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

