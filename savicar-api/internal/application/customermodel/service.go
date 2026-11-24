package customermodel

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/customermodel"
)

type Service struct{ repo customermodel.Repository }

func NewService(repo customermodel.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetAll(ctx context.Context) ([]customermodel.CustomerModel, error) {
	return s.repo.FindAll(ctx)
}

// FindByPlate returns the already-registered vehicle for a plate, or nil if
// none is on file — nil is not an error, it just means "check the external
// lookup instead."
func (s *Service) FindByPlate(ctx context.Context, plate string) (*customermodel.CustomerModel, error) {
	return s.repo.FindByPlate(ctx, plate)
}

func (s *Service) GetByID(ctx context.Context, id int) (*customermodel.CustomerModel, error) {
	cm, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if cm == nil {
		return nil, fmt.Errorf("customer_model %d not found", id)
	}
	return cm, nil
}

// Create inserts a new vehicle. When cm.ClientUUID is set (offline clients
// generate one before syncing), a retried sync after a lost response must not
// create a duplicate vehicle — so an existing row with that ClientUUID is
// returned as-is instead of inserting again.
func (s *Service) Create(ctx context.Context, cm *customermodel.CustomerModel) error {
	if cm.ClientUUID != nil && *cm.ClientUUID != "" {
		existing, err := s.repo.FindByClientUUID(ctx, *cm.ClientUUID)
		if err != nil {
			return err
		}
		if existing != nil {
			*cm = *existing
			return nil
		}
	}
	return s.repo.Create(ctx, cm)
}

func (s *Service) Update(ctx context.Context, cm *customermodel.CustomerModel) error {
	return s.repo.Update(ctx, cm)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

