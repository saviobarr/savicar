package serviceappointment

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]ServiceAppointment, error)
	FindByID(ctx context.Context, id int) (*ServiceAppointment, error)
	Create(ctx context.Context, sa *ServiceAppointment) error
	Update(ctx context.Context, sa *ServiceAppointment) error
	Delete(ctx context.Context, id int) error
}
