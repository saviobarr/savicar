package serviceappointmentresource

import "context"

type Repository interface {
	FindByAppointmentID(ctx context.Context, idServiceAppointment int) ([]ServiceAppointmentResource, error)
	FindByID(ctx context.Context, id int) (*ServiceAppointmentResource, error)
	Create(ctx context.Context, r *ServiceAppointmentResource) error
	Update(ctx context.Context, r *ServiceAppointmentResource) error
	Delete(ctx context.Context, id int) error
	DeleteByAppointmentID(ctx context.Context, idServiceAppointment int) error
}
