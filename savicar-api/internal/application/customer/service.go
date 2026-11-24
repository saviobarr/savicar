package customer

import (
	"context"
	"fmt"
	"strings"

	"savicar-api/internal/domain/customer"
)

type Service struct{ repo customer.Repository }

func NewService(repo customer.Repository) *Service { return &Service{repo: repo} }

// DuplicateTaxIDError is returned by Create when the given tax ID (CPF/CNPJ)
// already belongs to another customer.
type DuplicateTaxIDError struct {
	CustomerName string
}

func (e *DuplicateTaxIDError) Error() string {
	return fmt.Sprintf("CPF já cadastrado para o cliente %s", e.CustomerName)
}

func displayName(c *customer.Customer) string {
	if c.IndividualName != nil && strings.TrimSpace(*c.IndividualName) != "" {
		return *c.IndividualName
	}
	if c.TradeName != nil && strings.TrimSpace(*c.TradeName) != "" {
		return *c.TradeName
	}
	if c.LegalName != nil && strings.TrimSpace(*c.LegalName) != "" {
		return *c.LegalName
	}
	return ""
}

func (s *Service) GetAll(ctx context.Context) ([]customer.Customer, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*customer.Customer, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, fmt.Errorf("customer %d not found", id)
	}
	return c, nil
}

// Create inserts a new customer. When c.ClientUUID is set (offline clients
// generate one before syncing), a retried sync after a lost response must not
// create a duplicate customer — so an existing row with that ClientUUID is
// returned as-is instead of inserting again.
func (s *Service) Create(ctx context.Context, c *customer.Customer) error {
	if c.ClientUUID != nil && *c.ClientUUID != "" {
		existing, err := s.repo.FindByClientUUID(ctx, *c.ClientUUID)
		if err != nil {
			return err
		}
		if existing != nil {
			*c = *existing
			return nil
		}
	}
	if c.TaxID != nil && strings.TrimSpace(*c.TaxID) != "" {
		existing, err := s.repo.FindByTaxID(ctx, strings.TrimSpace(*c.TaxID))
		if err != nil {
			return err
		}
		if existing != nil {
			return &DuplicateTaxIDError{CustomerName: displayName(existing)}
		}
	}
	return s.repo.Create(ctx, c)
}

func (s *Service) Update(ctx context.Context, c *customer.Customer) error {
	return s.repo.Update(ctx, c)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

