package produtosnf

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]ProdutoNf, error)
	FindByID(ctx context.Context, id int) (*ProdutoNf, error)
	FindByNfID(ctx context.Context, nfID int) ([]ProdutoNf, error)
	Create(ctx context.Context, p *ProdutoNf) error
	Update(ctx context.Context, p *ProdutoNf) error
	Delete(ctx context.Context, id int) error
}
