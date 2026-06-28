package paymentmethod

import (
	"context"

	"savicar-api/internal/domain/paymentmethod"
)

type Service struct{ repo paymentmethod.Repository }

func NewService(repo paymentmethod.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]paymentmethod.PaymentMethod, error) {
	return s.repo.FindAll(ctx)
}

