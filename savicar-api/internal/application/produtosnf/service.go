package produtosnf

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/produtosnf"
)

type Service struct{ repo produtosnf.Repository }

func NewService(repo produtosnf.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]produtosnf.ProdutoNf, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*produtosnf.ProdutoNf, error) {
	p, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("produto nf %d not found", id)
	}
	return p, nil
}

func (s *Service) GetByNfID(ctx context.Context, nfID int) ([]produtosnf.ProdutoNf, error) {
	return s.repo.FindByNfID(ctx, nfID)
}

func (s *Service) Create(ctx context.Context, p *produtosnf.ProdutoNf) error {
	return s.repo.Create(ctx, p)
}

func (s *Service) Update(ctx context.Context, p *produtosnf.ProdutoNf) error {
	return s.repo.Update(ctx, p)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}
