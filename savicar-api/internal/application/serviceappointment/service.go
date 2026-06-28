package serviceappointment

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/serviceappointment"
	"savicar-api/internal/domain/serviceappointmentresource"
)

type Service struct {
	repo    serviceappointment.Repository
	sarRepo serviceappointmentresource.Repository
}

func NewService(repo serviceappointment.Repository, sarRepo serviceappointmentresource.Repository) *Service {
	return &Service{repo: repo, sarRepo: sarRepo}
}

func (s *Service) GetAll(ctx context.Context) ([]serviceappointment.ServiceAppointment, error) {
	return s.repo.FindAll(ctx)
}

func (s *Service) GetByID(ctx context.Context, id int) (*serviceappointment.ServiceAppointment, error) {
	sa, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sa == nil {
		return nil, fmt.Errorf("service appointment %d not found", id)
	}
	return sa, nil
}

func (s *Service) Create(ctx context.Context, sa *serviceappointment.ServiceAppointment) error {
	return s.repo.Create(ctx, sa)
}

func (s *Service) Update(ctx context.Context, sa *serviceappointment.ServiceAppointment) error {
	return s.repo.Update(ctx, sa)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	if err := s.sarRepo.DeleteByAppointmentID(ctx, id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

