package unity

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/unity"
)

type Service struct {
	repo unity.Repository
}

func NewService(repo unity.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetAll(ctx context.Context) ([]unity.Unity, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*unity.Unity, error) {
	u, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, fmt.Errorf("unity %d not found", id)
	}
	return u, nil
}

func (s *Service) Create(ctx context.Context, u *unity.Unity) error {
	return s.repo.Create(ctx, u)
}

func (s *Service) Update(ctx context.Context, u *unity.Unity) error {
	return s.repo.Update(ctx, u)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

