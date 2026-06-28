package user

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/user"
)

type Service struct{ repo user.Repository }

func NewService(repo user.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]user.User, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*user.User, error) {
	u, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, fmt.Errorf("user %d not found", id)
	}
	return u, nil
}

func (s *Service) Create(ctx context.Context, u *user.User) error {
	return s.repo.Create(ctx, u)
}

func (s *Service) Update(ctx context.Context, u *user.User) error {
	return s.repo.Update(ctx, u)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}
