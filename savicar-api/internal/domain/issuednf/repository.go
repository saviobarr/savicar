package issuednf

import "context"

type Repository interface {
	Create(ctx context.Context, n *IssuedNF) error
}
