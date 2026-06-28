package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/paymentmethod"
)

type SQLServerPaymentMethodRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerPaymentMethodRepository(db *sql.DB) *SQLServerPaymentMethodRepository {
	return &SQLServerPaymentMethodRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.paymentmethod"),
	}
}

func (r *SQLServerPaymentMethodRepository) FindAll(ctx context.Context) ([]paymentmethod.PaymentMethod, error) {
	query := "SELECT ID_PAYMENT_METHOD, DESCRIPTION FROM PAYMENT_METHOD ORDER BY ID_PAYMENT_METHOD"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []paymentmethod.PaymentMethod
	for rows.Next() {
		var m paymentmethod.PaymentMethod
		if err := rows.Scan(&m.IDPaymentMethod, &m.Description); err != nil {
			return nil, err
		}
		m.Description = trimStringPtr(m.Description)
		result = append(result, m)
	}
	return result, rows.Err()
}

