package customermodel

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]CustomerModel, error)
	FindByID(ctx context.Context, id int) (*CustomerModel, error)
	FindByClientUUID(ctx context.Context, clientUUID string) (*CustomerModel, error)
	// FindByPlate looks up an already-registered vehicle by plate, ignoring
	// punctuation/case, so a plate lookup can check our own records before
	// falling back to the paid external plate-lookup API.
	FindByPlate(ctx context.Context, plate string) (*CustomerModel, error)
	Create(ctx context.Context, cm *CustomerModel) error
	Update(ctx context.Context, cm *CustomerModel) error
	Delete(ctx context.Context, id int) error
}
