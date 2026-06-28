package services

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Service, error)
	FindByID(ctx context.Context, id int) (*Service, error)
	Create(ctx context.Context, s *Service) error
	Update(ctx context.Context, s *Service) error
	Delete(ctx context.Context, id int) error
}
