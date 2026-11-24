package nf

import "context"

type Repository interface {
	FindAll(ctx context.Context) ([]NF, error)
	FindByTipo(ctx context.Context, tipo int) ([]NF, error)
	FindByProtocolo(ctx context.Context, protocolo string) (*NF, error)
	// UpdateNFSeFields patches only the NFS-e-derived fields of an existing
	// row (each *string left nil keeps the current value) — used instead of
	// Update to avoid rewriting other columns (notably data_emissao) with a
	// value round-tripped from a prior scan, which MySQL's DATE column can
	// reject depending on its exact string form.
	UpdateNFSeFields(ctx context.Context, numero int, tomador, valorTotalNota, serie, urlDownload *string, tipo int) error
	FindByID(ctx context.Context, numero int) (*NF, error)
	Create(ctx context.Context, n *NF) error
	Update(ctx context.Context, n *NF) error
	Delete(ctx context.Context, numero int) error
	GetMaxNumero(ctx context.Context) (int, error)
}
