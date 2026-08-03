package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/produtosnf"
)

type SQLServerProdutosNfRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerProdutosNfRepository(db *sql.DB) *SQLServerProdutosNfRepository {
	return &SQLServerProdutosNfRepository{db: db, log: slog.Default().WithGroup("repository.produtosnf")}
}

const produtosNfColumns = "id_produto, numero, descricao, unidade, quantidade, vl_unitario, vl_total, bc_icms, vl_icms, aliquota_icms"

func scanProdutoNf(row interface{ Scan(...any) error }, p *produtosnf.ProdutoNf) error {
	return row.Scan(
		&p.IDProduto, &p.Numero, &p.Descricao, &p.Unidade, &p.Quantidade, &p.VlUnitario, &p.VlTotal,
		&p.BcIcms, &p.VlIcms, &p.AliquotaIcms,
	)
}

func (r *SQLServerProdutosNfRepository) FindAll(ctx context.Context) ([]produtosnf.ProdutoNf, error) {
	query := "SELECT " + produtosNfColumns + " FROM produtos_nf"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []produtosnf.ProdutoNf
	for rows.Next() {
		var p produtosnf.ProdutoNf
		if err := scanProdutoNf(rows, &p); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func (r *SQLServerProdutosNfRepository) FindByID(ctx context.Context, id int) (*produtosnf.ProdutoNf, error) {
	query := "SELECT " + produtosNfColumns + " FROM produtos_nf WHERE id_produto = ?"
	var p produtosnf.ProdutoNf
	err := scanProdutoNf(r.db.QueryRowContext(ctx, query, id), &p)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	return &p, nil
}

func (r *SQLServerProdutosNfRepository) FindByNfID(ctx context.Context, nfID int) ([]produtosnf.ProdutoNf, error) {
	query := "SELECT " + produtosNfColumns + " FROM produtos_nf WHERE numero = ?"
	rows, err := r.db.QueryContext(ctx, query, nfID)
	if err != nil {
		r.log.ErrorContext(ctx, "FindByNfID failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []produtosnf.ProdutoNf
	for rows.Next() {
		var p produtosnf.ProdutoNf
		if err := scanProdutoNf(rows, &p); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func (r *SQLServerProdutosNfRepository) Create(ctx context.Context, p *produtosnf.ProdutoNf) error {
	query := "INSERT INTO produtos_nf (numero, descricao, unidade, quantidade, vl_unitario, vl_total, bc_icms, vl_icms, aliquota_icms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
	result, err := r.db.ExecContext(ctx, query, p.Numero, p.Descricao, p.Unidade, p.Quantidade, p.VlUnitario, p.VlTotal, p.BcIcms, p.VlIcms, p.AliquotaIcms)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	p.IDProduto = int(id)
	return nil
}

func (r *SQLServerProdutosNfRepository) Update(ctx context.Context, p *produtosnf.ProdutoNf) error {
	query := `UPDATE produtos_nf SET numero = ?, descricao = ?, unidade = ?, quantidade = ?, vl_unitario = ?, vl_total = ?,
	 bc_icms = ?, vl_icms = ?, aliquota_icms = ? WHERE id_produto = ?`
	_, err := r.db.ExecContext(ctx, query, p.Numero, p.Descricao, p.Unidade, p.Quantidade, p.VlUnitario, p.VlTotal, p.BcIcms, p.VlIcms, p.AliquotaIcms, p.IDProduto)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", p.IDProduto), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerProdutosNfRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM produtos_nf WHERE id_produto = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}
