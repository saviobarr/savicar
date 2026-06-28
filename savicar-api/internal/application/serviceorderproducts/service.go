package serviceorderproducts

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/inventory"
	"savicar-api/internal/domain/serviceorderproducts"
)

type Service struct {
	repo      serviceorderproducts.Repository
	inventory inventory.Repository
}

func NewService(repo serviceorderproducts.Repository, inv inventory.Repository) *Service {
	return &Service{repo: repo, inventory: inv}
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
	if sop.IDProduct != nil && sop.Quantity != nil {
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
	// restore quantity on delete
	if old != nil && old.IDProduct != nil && old.Quantity != nil {
		_ = s.inventory.AdjustQuantity(ctx, *old.IDProduct, *old.Quantity)
	}
	return nil
}

