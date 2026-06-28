package persistence

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	"savicar-api/internal/domain/audit"
)

type SQLAuditRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLAuditRepository(db *sql.DB) *SQLAuditRepository {
	return &SQLAuditRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.audit"),
	}
}

func (r *SQLAuditRepository) Save(ctx context.Context, a *audit.Audit) error {
	query := "INSERT INTO AUDIT (ID_TENANT, USER, URL_CALLED, PAYLOAD, DT_TIME) VALUES (?, ?, ?, ?, ?)"
	_, err := r.db.ExecContext(ctx, query, a.IDTenant, a.User, a.URLCalled, a.Payload, a.DateTime.Format(time.DateTime))
	if err != nil {
		r.log.ErrorContext(ctx, "audit save failed", slog.Any("error", err))
	}
	return err
}

func (r *SQLAuditRepository) FindAll(ctx context.Context) ([]audit.Audit, error) {
	query := "SELECT ID_AUDIT, ID_TENANT, USER, URL_CALLED, PAYLOAD, DT_TIME FROM AUDIT ORDER BY DT_TIME DESC LIMIT 500"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []audit.Audit
	for rows.Next() {
		var a audit.Audit
		var payload sql.NullString
		var dtStr string
		if err := rows.Scan(&a.IDAudit, &a.IDTenant, &a.User, &a.URLCalled, &payload, &dtStr); err != nil {
			return nil, err
		}
		if payload.Valid {
			a.Payload = &payload.String
		}
		if t, err := time.Parse(time.DateTime, dtStr); err == nil {
			a.DateTime = t
		}
		result = append(result, a)
	}
	return result, rows.Err()
}
