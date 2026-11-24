package persistence

import (
	"context"
	"database/sql"
	"log/slog"
	"sync"

	"savicar-api/internal/domain/nf"
)

type SQLServerNFRepository struct {
	db       *sql.DB
	log      *slog.Logger
	seqMu    sync.Mutex
	seqReady bool
}

func NewSQLServerNFRepository(db *sql.DB) *SQLServerNFRepository {
	return &SQLServerNFRepository{db: db, log: slog.Default().WithGroup("repository.nf")}
}

const nfColumns = `numero, serie, natureza, chave_acesso, protocolo, inscricao_estadual, cnpj, endereco,
	 data_emissao, data_saida, municipio, uf, base_icms, valor_icms, base_icms_st, valor_icms_st,
	 valor_frete, valor_ipi, valor_total_produtos, valor_total_nota, url_download, tomador, tipo`

func scanNF(row interface{ Scan(...any) error }, n *nf.NF) error {
	return row.Scan(
		&n.Numero, &n.Serie, &n.Natureza, &n.ChaveAcesso, &n.Protocolo, &n.InscricaoEstadual, &n.Cnpj, &n.Endereco,
		&n.DataEmissao, &n.DataSaida, &n.Municipio, &n.Uf, &n.BaseIcms, &n.ValorIcms, &n.BaseIcmsSt, &n.ValorIcmsSt,
		&n.ValorFrete, &n.ValorIpi, &n.ValorTotalProdutos, &n.ValorTotalNota, &n.UrlDownload, &n.Tomador, &n.Tipo,
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

func (r *SQLServerNFRepository) FindByTipo(ctx context.Context, tipo int) ([]nf.NF, error) {
	query := "SELECT " + nfColumns + " FROM nf WHERE tipo = ? ORDER BY numero DESC"
	rows, err := r.db.QueryContext(ctx, query, tipo)
	if err != nil {
		r.log.ErrorContext(ctx, "FindByTipo failed", slog.Int("tipo", tipo), slog.Any("error", err))
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

func (r *SQLServerNFRepository) FindByProtocolo(ctx context.Context, protocolo string) (*nf.NF, error) {
	query := "SELECT " + nfColumns + " FROM nf WHERE protocolo = ? ORDER BY numero DESC LIMIT 1"
	var n nf.NF
	err := scanNF(r.db.QueryRowContext(ctx, query, protocolo), &n)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByProtocolo failed", slog.String("protocolo", protocolo), slog.Any("error", err))
		return nil, err
	}
	return &n, nil
}

func (r *SQLServerNFRepository) UpdateNFSeFields(ctx context.Context, numero int, tomador, valorTotalNota, serie, urlDownload *string, tipo int) error {
	query := `UPDATE nf SET
		tipo = ?,
		tomador = COALESCE(?, tomador),
		valor_total_nota = COALESCE(?, valor_total_nota),
		serie = COALESCE(?, serie),
		url_download = COALESCE(?, url_download)
		WHERE numero = ?`
	_, err := r.db.ExecContext(ctx, query, tipo, tomador, valorTotalNota, serie, urlDownload, numero)
	if err != nil {
		r.log.ErrorContext(ctx, "UpdateNFSeFields failed", slog.Int("numero", numero), slog.Any("error", err))
	}
	return err
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
	if err := r.ensureSequence(ctx); err != nil {
		return err
	}

	// The number comes from NF_SEQUENCE, locked for the whole transaction:
	// concurrent creators queue up, and if the INSERT fails the rollback
	// also undoes the counter bump — so numbers never skip (unlike
	// AUTO_INCREMENT, which burns a value on every failed insert and may
	// step by auto_increment_increment).
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var last, max int
	if err := tx.QueryRowContext(ctx, "SELECT ultimo_numero FROM NF_SEQUENCE WHERE id = 1 FOR UPDATE").Scan(&last); err != nil {
		r.log.ErrorContext(ctx, "Create: lock sequence failed", slog.Any("error", err))
		return err
	}
	if err := tx.QueryRowContext(ctx, "SELECT COALESCE(MAX(numero), 0) FROM nf").Scan(&max); err != nil {
		return err
	}
	if last > max {
		max = last
	}
	n.Numero = max + 1

	if _, err := tx.ExecContext(ctx, "UPDATE NF_SEQUENCE SET ultimo_numero = ? WHERE id = 1", n.Numero); err != nil {
		r.log.ErrorContext(ctx, "Create: bump sequence failed", slog.Any("error", err))
		return err
	}

	query := `INSERT INTO nf (numero, serie, natureza, chave_acesso, protocolo, inscricao_estadual, cnpj, endereco,
	 data_emissao, data_saida, municipio, uf, base_icms, valor_icms, base_icms_st, valor_icms_st,
	 valor_frete, valor_ipi, valor_total_produtos, valor_total_nota, url_download, tomador, tipo)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	args := []any{
		n.Numero, n.Serie, n.Natureza, n.ChaveAcesso, n.Protocolo, n.InscricaoEstadual, n.Cnpj, n.Endereco,
		n.DataEmissao, n.DataSaida, n.Municipio, n.Uf, n.BaseIcms, n.ValorIcms, n.BaseIcmsSt, n.ValorIcmsSt,
		n.ValorFrete, n.ValorIpi, n.ValorTotalProdutos, n.ValorTotalNota, n.UrlDownload, n.Tomador, n.Tipo,
	}
	r.log.InfoContext(ctx, "insert", slog.String("sql", query), slog.Any("args", args))
	if _, err := tx.ExecContext(ctx, query, args...); err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		n.Numero = 0
		return err
	}
	if err := tx.Commit(); err != nil {
		n.Numero = 0
		return err
	}
	return nil
}

// ensureSequence creates NF_SEQUENCE on first use (same DDL as
// migration_nf_sequence.sql) so a deploy without the manual migration still
// works. The counter row is seeded from the current MAX(numero).
func (r *SQLServerNFRepository) ensureSequence(ctx context.Context) error {
	r.seqMu.Lock()
	defer r.seqMu.Unlock()
	if r.seqReady {
		return nil
	}
	if _, err := r.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS NF_SEQUENCE (
		id TINYINT NOT NULL PRIMARY KEY,
		ultimo_numero INT NOT NULL DEFAULT 0
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`); err != nil {
		r.log.ErrorContext(ctx, "ensureSequence failed", slog.Any("error", err))
		return err
	}
	if _, err := r.db.ExecContext(ctx, `INSERT IGNORE INTO NF_SEQUENCE (id, ultimo_numero)
		SELECT 1, COALESCE(MAX(numero), 0) FROM nf`); err != nil {
		r.log.ErrorContext(ctx, "ensureSequence seed failed", slog.Any("error", err))
		return err
	}
	r.seqReady = true
	return nil
}

func (r *SQLServerNFRepository) Update(ctx context.Context, n *nf.NF) error {
	query := `UPDATE nf SET serie = ?, natureza = ?, chave_acesso = ?, protocolo = ?, inscricao_estadual = ?,
	 cnpj = ?, endereco = ?, data_emissao = ?, data_saida = ?, municipio = ?, uf = ?, base_icms = ?,
	 valor_icms = ?, base_icms_st = ?, valor_icms_st = ?, valor_frete = ?, valor_ipi = ?,
	 valor_total_produtos = ?, valor_total_nota = ?, url_download = ?, tomador = ?, tipo = ?
	 WHERE numero = ?`
	_, err := r.db.ExecContext(ctx, query,
		n.Serie, n.Natureza, n.ChaveAcesso, n.Protocolo, n.InscricaoEstadual, n.Cnpj, n.Endereco,
		n.DataEmissao, n.DataSaida, n.Municipio, n.Uf, n.BaseIcms, n.ValorIcms, n.BaseIcmsSt, n.ValorIcmsSt,
		n.ValorFrete, n.ValorIpi, n.ValorTotalProdutos, n.ValorTotalNota, n.UrlDownload, n.Tomador, n.Tipo, n.Numero,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("numero", n.Numero), slog.Any("error", err))
	}
	return err
}

// GetMaxNumero returns the last number handed out: the greater of the
// sequence counter and the highest numero in nf (the counter survives
// deletes, so a removed last note's number is never reused).
func (r *SQLServerNFRepository) GetMaxNumero(ctx context.Context) (int, error) {
	if err := r.ensureSequence(ctx); err != nil {
		return 0, err
	}
	var max int
	err := r.db.QueryRowContext(ctx, `SELECT GREATEST(
		COALESCE((SELECT MAX(numero) FROM nf), 0),
		COALESCE((SELECT ultimo_numero FROM NF_SEQUENCE WHERE id = 1), 0))`).Scan(&max)
	if err != nil {
		r.log.ErrorContext(ctx, "GetMaxNumero failed", slog.Any("error", err))
		return 0, err
	}
	return max, nil
}

func (r *SQLServerNFRepository) Delete(ctx context.Context, numero int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM nf WHERE numero = ?", numero)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("numero", numero), slog.Any("error", err))
	}
	return err
}
