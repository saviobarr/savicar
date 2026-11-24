package services

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/services"
	"savicar-api/internal/domain/user"
)

// Actor identifies who is calling Create, taken from the JWT claims in the
// request context — used to decide whether admins should be notified.
type Actor struct {
	UserID   int
	UserName string
	Profile  int
	IDTenant int
}

type Service struct {
	repo     services.Repository
	notifier services.Notifier
}

func NewService(repo services.Repository, notifier services.Notifier) *Service {
	return &Service{repo: repo, notifier: notifier}
}

func (s *Service) GetAll(ctx context.Context) ([]services.Service, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*services.Service, error) {
	svc, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if svc == nil {
		return nil, fmt.Errorf("service %d not found", id)
	}
	return svc, nil
}

func (s *Service) Create(ctx context.Context, svc *services.Service, actor Actor) error {
	if svc.Status == nil {
		orcamento := 0
		svc.Status = &orcamento
	}
	if err := s.repo.Create(ctx, svc); err != nil {
		return err
	}
	if s.notifier != nil && actor.Profile == int(user.ProfileTechnician) && svc.IDOrder != nil {
		name := actor.UserName
		if name == "" {
			name = "Um mecânico"
		}
		msg := fmt.Sprintf("Tecnico %s adicionou serviço na OS #%d", name, *svc.IDOrder)
		_ = s.notifier.NotifyAdmins(ctx, actor.IDTenant, *svc.IDOrder, msg)
	}
	return nil
}

func (s *Service) Update(ctx context.Context, svc *services.Service) error {
	return s.repo.Update(ctx, svc)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

