package inventory

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/inventory"
)

type Service struct {
	repo           inventory.Repository
	externalLookup inventory.ExternalLookup
}

func NewService(repo inventory.Repository, externalLookup inventory.ExternalLookup) *Service {
	return &Service{repo: repo, externalLookup: externalLookup}
}

func (s *Service) GetAll(ctx context.Context) ([]inventory.Inventory, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*inventory.Inventory, error) {
	inv, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if inv == nil {
		return nil, fmt.Errorf("inventory product %d not found", id)
	}
	return inv, nil
}

func (s *Service) GetByBarcode(ctx context.Context, code string) (*inventory.Inventory, error) {
	inv, err := s.repo.FindByBarcode(ctx, code)
	if err != nil {
		return nil, err
	}
	if inv == nil {
		return nil, fmt.Errorf("inventory product with barcode %q not found", code)
	}
	return inv, nil
}

func (s *Service) LookupExternal(ctx context.Context, code string) (*inventory.ExternalProduct, error) {
	product, err := s.externalLookup.Lookup(ctx, code)
	if err != nil {
		return nil, err
	}
	if product == nil {
		return nil, fmt.Errorf("product with barcode %q not found in external database", code)
	}
	return product, nil
}

func (s *Service) Create(ctx context.Context, inv *inventory.Inventory) error {
	return s.repo.Create(ctx, inv)
}

func (s *Service) Update(ctx context.Context, inv *inventory.Inventory) error {
	return s.repo.Update(ctx, inv)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) AdjustQuantity(ctx context.Context, idProduct int, delta float64) error {
	return s.repo.AdjustQuantity(ctx, idProduct, delta)
}

