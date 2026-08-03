package nf

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/nf"
)

type Service struct{ repo nf.Repository }

func NewService(repo nf.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]nf.NF, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*nf.NF, error) {
	n, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if n == nil {
		return nil, fmt.Errorf("nf %d not found", id)
	}
	return n, nil
}

func (s *Service) Create(ctx context.Context, n *nf.NF) error {
	return s.repo.Create(ctx, n)
}

func (s *Service) Update(ctx context.Context, n *nf.NF) error {
	return s.repo.Update(ctx, n)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}
