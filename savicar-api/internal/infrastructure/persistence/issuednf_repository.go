package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/issuednf"
)

type SQLServerIssuedNFRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerIssuedNFRepository(db *sql.DB) *SQLServerIssuedNFRepository {
	return &SQLServerIssuedNFRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.issuednf"),
	}
}

func (r *SQLServerIssuedNFRepository) Create(ctx context.Context, n *issuednf.IssuedNF) error {
	_, err := r.db.ExecContext(ctx, "INSERT INTO ISSUED_NF (ID_NF, ISSUED_DATE, RECEIVER) VALUES (?, ?, ?)",
		n.IDNf, n.IssuedDate, n.Receiver)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
	}
	return err
}
