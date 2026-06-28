package serviceappointmentresource

import (
	"context"
	"fmt"

	"savicar-api/internal/domain/serviceappointmentresource"
)

type Service struct{ repo serviceappointmentresource.Repository }

func NewService(repo serviceappointmentresource.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetByAppointmentID(ctx context.Context, id int) ([]serviceappointmentresource.ServiceAppointmentResource, error) {
	return s.repo.FindByAppointmentID(ctx, id)
}

func (s *Service) GetByID(ctx context.Context, id int) (*serviceappointmentresource.ServiceAppointmentResource, error) {
	r, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, fmt.Errorf("appointment resource %d not found", id)
	}
	return r, nil
}

func (s *Service) Create(ctx context.Context, r *serviceappointmentresource.ServiceAppointmentResource) error {
	return s.repo.Create(ctx, r)
}

func (s *Service) Update(ctx context.Context, r *serviceappointmentresource.ServiceAppointmentResource) error {
	return s.repo.Update(ctx, r)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

