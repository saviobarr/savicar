package payment

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/payment"
)

type Service struct{ repo payment.Repository }

func NewService(repo payment.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]payment.Payment, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*payment.Payment, error) {
	p, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("payment %d not found", id)
	}
	return p, nil
}

func (s *Service) GetByOrderID(ctx context.Context, orderID int) ([]payment.Payment, error) {
	return s.repo.FindByOrderID(ctx, orderID)
}

func (s *Service) Create(ctx context.Context, p *payment.Payment) error {
	return s.repo.Create(ctx, p)
}

func (s *Service) Update(ctx context.Context, p *payment.Payment) error {
	return s.repo.Update(ctx, p)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

