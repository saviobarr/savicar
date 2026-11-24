package serviceorder

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/inventory"
	"savicar-api/internal/domain/serviceorder"
	"savicar-api/internal/domain/serviceorderproducts"
	"savicar-api/internal/domain/user"
)

const statusOrcamento = 0

// Actor identifies who is calling Update, taken from the JWT claims in the
// request context — used to decide whether admins should be notified.
type Actor struct {
	UserID   int
	UserName string
	Profile  int
	IDTenant int
}

type Service struct {
	repo      serviceorder.Repository
	products  serviceorderproducts.Repository
	inventory inventory.Repository
	notifier  serviceorder.Notifier
}

func NewService(repo serviceorder.Repository, products serviceorderproducts.Repository, inv inventory.Repository, notifier serviceorder.Notifier) *Service {
	return &Service{repo: repo, products: products, inventory: inv, notifier: notifier}
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

// Create inserts a new service order. When so.ClientUUID is set (offline
// clients generate one before syncing), a retried sync after a lost response
// must not create a duplicate order — so an existing row with that
// ClientUUID is returned as-is instead of inserting again.
func (s *Service) Create(ctx context.Context, so *serviceorder.ServiceOrder) error {
	if so.ClientUUID != nil && *so.ClientUUID != "" {
		existing, err := s.repo.FindByClientUUID(ctx, *so.ClientUUID)
		if err != nil {
			return err
		}
		if existing != nil {
			*so = *existing
			return nil
		}
	}
	return s.repo.Create(ctx, so)
}

func (s *Service) Update(ctx context.Context, so *serviceorder.ServiceOrder, actor Actor) error {
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
	if s.notifier != nil && actor.Profile == int(user.ProfileTechnician) {
		name := actor.UserName
		if name == "" {
			name = "Um mecânico"
		}
		msg := fmt.Sprintf("%s atualizou a OS #%d", name, so.IDOrder)
		_ = s.notifier.NotifyAdmins(ctx, actor.IDTenant, so.IDOrder, msg)
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

