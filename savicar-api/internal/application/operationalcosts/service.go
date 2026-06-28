package operationalcosts

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/operationalcosts"
)

type Service struct{ repo operationalcosts.Repository }

func NewService(repo operationalcosts.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]operationalcosts.OperationalCost, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*operationalcosts.OperationalCost, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, fmt.Errorf("operational cost %d not found", id)
	}
	return c, nil
}

func (s *Service) Create(ctx context.Context, c *operationalcosts.OperationalCost) error {
	return s.repo.Create(ctx, c)
}

func (s *Service) Update(ctx context.Context, c *operationalcosts.OperationalCost) error {
	return s.repo.Update(ctx, c)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

