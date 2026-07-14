package inventory

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]Inventory, error)
	FindByID(ctx context.Context, id int) (*Inventory, error)
	FindByBarcode(ctx context.Context, code string) (*Inventory, error)
	Create(ctx context.Context, inv *Inventory) error
	Update(ctx context.Context, inv *Inventory) error
	Delete(ctx context.Context, id int) error
	AdjustQuantity(ctx context.Context, idProduct int, delta float64) error
}
