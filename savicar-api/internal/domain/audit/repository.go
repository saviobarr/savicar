package audit

import "context"

type Repository interface {
	Save(ctx context.Context, a *Audit) error
	FindAll(ctx context.Context) ([]Audit, error)
}
