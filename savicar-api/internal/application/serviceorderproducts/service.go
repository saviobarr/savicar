package serviceorderproducts

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/inventory"
	"savicar-api/internal/domain/serviceorder"
	"savicar-api/internal/domain/serviceorderproducts"
)

const statusOrcamento = 0

type Service struct {
	repo      serviceorderproducts.Repository
	inventory inventory.Repository
	orders    serviceorder.Repository
}

func NewService(repo serviceorderproducts.Repository, inv inventory.Repository, orders serviceorder.Repository) *Service {
	return &Service{repo: repo, inventory: inv, orders: orders}
}

// isOrcamento returns true when the service order linked to sop is in "Orçamento" status,
// meaning inventory should not be touched.
func (s *Service) isOrcamento(ctx context.Context, orderID *int) bool {
	if orderID == nil {
		return false
	}
	so, err := s.orders.FindByID(ctx, *orderID)
	if err != nil || so == nil || so.Status == nil {
		return false
	}
	return *so.Status == statusOrcamento
}

func (s *Service) GetAll(ctx context.Context) ([]serviceorderproducts.ServiceOrderProduct, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*serviceorderproducts.ServiceOrderProduct, error) {
	sop, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sop == nil {
		return nil, fmt.Errorf("service_order_product %d not found", id)
	}
	return sop, nil
}

func (s *Service) GetByOrderID(ctx context.Context, orderID int) ([]serviceorderproducts.ServiceOrderProduct, error) {
	return s.repo.FindByOrderID(ctx, orderID)
}

func (s *Service) Create(ctx context.Context, sop *serviceorderproducts.ServiceOrderProduct) error {
	if err := s.repo.Create(ctx, sop); err != nil {
		return err
	}
	if !s.isOrcamento(ctx, sop.IDOrder) && sop.IDProduct != nil && sop.Quantity != nil {
		_ = s.inventory.AdjustQuantity(ctx, *sop.IDProduct, -*sop.Quantity)
	}
	return nil
}

func (s *Service) Update(ctx context.Context, sop *serviceorderproducts.ServiceOrderProduct) error {
	old, err := s.repo.FindByID(ctx, sop.IDServiceOrderProduct)
	if err != nil {
		return err
	}
	if err := s.repo.Update(ctx, sop); err != nil {
		return err
	}
	if s.isOrcamento(ctx, sop.IDOrder) {
		return nil
	}
	// revert old quantity, apply new quantity
	if old != nil && old.IDProduct != nil && old.Quantity != nil {
		_ = s.inventory.AdjustQuantity(ctx, *old.IDProduct, *old.Quantity)
	}
	if sop.IDProduct != nil && sop.Quantity != nil {
		_ = s.inventory.AdjustQuantity(ctx, *sop.IDProduct, -*sop.Quantity)
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, id int) error {
	old, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	// restore quantity on delete only if not Orçamento
	if old != nil && !s.isOrcamento(ctx, old.IDOrder) && old.IDProduct != nil && old.Quantity != nil {
		_ = s.inventory.AdjustQuantity(ctx, *old.IDProduct, *old.Quantity)
	}
	return nil
}

