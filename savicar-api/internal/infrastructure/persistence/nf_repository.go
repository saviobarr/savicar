package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/nf"
)

type SQLServerNFRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerNFRepository(db *sql.DB) *SQLServerNFRepository {
	return &SQLServerNFRepository{db: db, log: slog.Default().WithGroup("repository.nf")}
}

const nfColumns = `numero, serie, natureza, chave_acesso, protocolo, inscricao_estadual, cnpj, endereco,
	 data_emissao, data_saida, municipio, uf, base_icms, valor_icms, base_icms_st, valor_icms_st,
	 valor_frete, valor_ipi, valor_total_produtos, valor_total_nota`

func scanNF(row interface{ Scan(...any) error }, n *nf.NF) error {
	return row.Scan(
		&n.Numero, &n.Serie, &n.Natureza, &n.ChaveAcesso, &n.Protocolo, &n.InscricaoEstadual, &n.Cnpj, &n.Endereco,
		&n.DataEmissao, &n.DataSaida, &n.Municipio, &n.Uf, &n.BaseIcms, &n.ValorIcms, &n.BaseIcmsSt, &n.ValorIcmsSt,
		&n.ValorFrete, &n.ValorIpi, &n.ValorTotalProdutos, &n.ValorTotalNota,
	)
}

func (r *SQLServerNFRepository) FindAll(ctx context.Context) ([]nf.NF, error) {
	query := "SELECT " + nfColumns + " FROM nf ORDER BY numero DESC"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []nf.NF
	for rows.Next() {
		var n nf.NF
		if err := scanNF(rows, &n); err != nil {
			return nil, err
		}
		result = append(result, n)
	}
	return result, rows.Err()
}

func (r *SQLServerNFRepository) FindByID(ctx context.Context, numero int) (*nf.NF, error) {
	query := "SELECT " + nfColumns + " FROM nf WHERE numero = ?"
	var n nf.NF
	err := scanNF(r.db.QueryRowContext(ctx, query, numero), &n)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("numero", numero), slog.Any("error", err))
		return nil, err
	}
	return &n, nil
}

func (r *SQLServerNFRepository) Create(ctx context.Context, n *nf.NF) error {
	query := `INSERT INTO nf (serie, natureza, chave_acesso, protocolo, inscricao_estadual, cnpj, endereco,
	 data_emissao, data_saida, municipio, uf, base_icms, valor_icms, base_icms_st, valor_icms_st,
	 valor_frete, valor_ipi, valor_total_produtos, valor_total_nota)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query,
		n.Serie, n.Natureza, n.ChaveAcesso, n.Protocolo, n.InscricaoEstadual, n.Cnpj, n.Endereco,
		n.DataEmissao, n.DataSaida, n.Municipio, n.Uf, n.BaseIcms, n.ValorIcms, n.BaseIcmsSt, n.ValorIcmsSt,
		n.ValorFrete, n.ValorIpi, n.ValorTotalProdutos, n.ValorTotalNota,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	n.Numero = int(id)
	return nil
}

func (r *SQLServerNFRepository) Update(ctx context.Context, n *nf.NF) error {
	query := `UPDATE nf SET serie = ?, natureza = ?, chave_acesso = ?, protocolo = ?, inscricao_estadual = ?,
	 cnpj = ?, endereco = ?, data_emissao = ?, data_saida = ?, municipio = ?, uf = ?, base_icms = ?,
	 valor_icms = ?, base_icms_st = ?, valor_icms_st = ?, valor_frete = ?, valor_ipi = ?,
	 valor_total_produtos = ?, valor_total_nota = ?
	 WHERE numero = ?`
	_, err := r.db.ExecContext(ctx, query,
		n.Serie, n.Natureza, n.ChaveAcesso, n.Protocolo, n.InscricaoEstadual, n.Cnpj, n.Endereco,
		n.DataEmissao, n.DataSaida, n.Municipio, n.Uf, n.BaseIcms, n.ValorIcms, n.BaseIcmsSt, n.ValorIcmsSt,
		n.ValorFrete, n.ValorIpi, n.ValorTotalProdutos, n.ValorTotalNota, n.Numero,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("numero", n.Numero), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerNFRepository) Delete(ctx context.Context, numero int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM nf WHERE numero = ?", numero)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("numero", numero), slog.Any("error", err))
	}
	return err
}
