package technician

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/technician"
)

type Service struct{ repo technician.Repository }

func NewService(repo technician.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]technician.Technician, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*technician.Technician, error) {
	t, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, fmt.Errorf("technician %d not found", id)
	}
	return t, nil
}

func (s *Service) Create(ctx context.Context, t *technician.Technician) error {
	return s.repo.Create(ctx, t)
}

func (s *Service) Update(ctx context.Context, t *technician.Technician) error {
	return s.repo.Update(ctx, t)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

