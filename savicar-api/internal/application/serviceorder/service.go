package serviceorder

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/inventory"
	"savicar-api/internal/domain/serviceorder"
	"savicar-api/internal/domain/serviceorderproducts"
)

const statusOrcamento = 0

type Service struct {
	repo     serviceorder.Repository
	products serviceorderproducts.Repository
	inventory inventory.Repository
}

func NewService(repo serviceorder.Repository, products serviceorderproducts.Repository, inv inventory.Repository) *Service {
	return &Service{repo: repo, products: products, inventory: inv}
}

func (s *Service) GetAll(ctx context.Context) ([]serviceorder.ServiceOrder, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*serviceorder.ServiceOrder, error) {
	so, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if so == nil {
		return nil, fmt.Errorf("service order %d not found", id)
	}
	return so, nil
}

func (s *Service) Create(ctx context.Context, so *serviceorder.ServiceOrder) error {
	return s.repo.Create(ctx, so)
}

func (s *Service) Update(ctx context.Context, so *serviceorder.ServiceOrder) error {
	old, err := s.repo.FindByID(ctx, so.IDOrder)
	if err != nil {
		return err
	}
	if err := s.repo.Update(ctx, so); err != nil {
		return err
	}
	// Transition out of Orçamento: decrement inventory for all listed products
	oldIsOrcamento := old != nil && old.Status != nil && *old.Status == statusOrcamento
	newIsOrcamento := so.Status != nil && *so.Status == statusOrcamento
	if oldIsOrcamento && !newIsOrcamento {
		items, err := s.products.FindByOrderID(ctx, so.IDOrder)
		if err == nil {
			for _, p := range items {
				if p.IDProduct != nil && p.Quantity != nil {
					_ = s.inventory.AdjustQuantity(ctx, *p.IDProduct, -*p.Quantity)
				}
			}
		}
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

