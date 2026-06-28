package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/payment"
)

type SQLServerPaymentRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerPaymentRepository(db *sql.DB) *SQLServerPaymentRepository {
	return &SQLServerPaymentRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.payment"),
	}
}

func scanPayment(rows interface {
	Scan(...any) error
}, p *payment.Payment) error {
	var dueDate, paymentDate sql.NullString
	if err := rows.Scan(
		&p.IDPayment, &p.IDOrder, &p.IDPaymentMethod, &p.PaymentMethodDesc,
		&p.InstallmentsQuantity, &dueDate, &paymentDate, &p.Value,
	); err != nil {
		return err
	}
	if dueDate.Valid && len(dueDate.String) >= 10 {
		s := dueDate.String[:10]
		p.DueDate = &s
	}
	if paymentDate.Valid && len(paymentDate.String) >= 10 {
		s := paymentDate.String[:10]
		p.PaymentDate = &s
	}
	p.PaymentMethodDesc = trimStringPtr(p.PaymentMethodDesc)
	p.InstallmentsQuantity = trimStringPtr(p.InstallmentsQuantity)
	return nil
}

const paymentSelect = `SELECT p.ID_PAYMENT, p.ID_ORDER, p.ID_PAYMENT_METHOD,
 pm.DESCRIPTION, p.INSTALLMENTS_QUANTITY,
 DATE_FORMAT(p.DUE_DATE, '%Y-%m-%d'), DATE_FORMAT(p.PAYMENT_DATE, '%Y-%m-%d'), p.VALUE
 FROM PAYMENT p
 LEFT JOIN PAYMENT_METHOD pm ON pm.ID_PAYMENT_METHOD = p.ID_PAYMENT_METHOD`

func (r *SQLServerPaymentRepository) FindAll(ctx context.Context) ([]payment.Payment, error) {
	rows, err := r.db.QueryContext(ctx, paymentSelect)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []payment.Payment
	for rows.Next() {
		var p payment.Payment
		if err := scanPayment(rows, &p); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func (r *SQLServerPaymentRepository) FindByID(ctx context.Context, id int) (*payment.Payment, error) {
	query := paymentSelect + " WHERE p.ID_PAYMENT = ?"
	var p payment.Payment
	var dueDate, paymentDate sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&p.IDPayment, &p.IDOrder, &p.IDPaymentMethod, &p.PaymentMethodDesc,
		&p.InstallmentsQuantity, &dueDate, &paymentDate, &p.Value,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Any("error", err))
		return nil, err
	}
	if dueDate.Valid && len(dueDate.String) >= 10 {
		s := dueDate.String[:10]
		p.DueDate = &s
	}
	if paymentDate.Valid && len(paymentDate.String) >= 10 {
		s := paymentDate.String[:10]
		p.PaymentDate = &s
	}
	p.PaymentMethodDesc = trimStringPtr(p.PaymentMethodDesc)
	p.InstallmentsQuantity = trimStringPtr(p.InstallmentsQuantity)
	return &p, nil
}

func (r *SQLServerPaymentRepository) FindByOrderID(ctx context.Context, orderID int) ([]payment.Payment, error) {
	query := paymentSelect + " WHERE p.ID_ORDER = ?"
	rows, err := r.db.QueryContext(ctx, query, orderID)
	if err != nil {
		r.log.ErrorContext(ctx, "FindByOrderID failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []payment.Payment
	for rows.Next() {
		var p payment.Payment
		if err := scanPayment(rows, &p); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func (r *SQLServerPaymentRepository) Create(ctx context.Context, p *payment.Payment) error {
	query := `INSERT INTO PAYMENT (ID_ORDER, ID_PAYMENT_METHOD, INSTALLMENTS_QUANTITY, DUE_DATE, PAYMENT_DATE, VALUE)
	 VALUES (?, ?, ?, ?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query,
		p.IDOrder, p.IDPaymentMethod, p.InstallmentsQuantity, p.DueDate, p.PaymentDate, p.Value,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	p.IDPayment = int(id)
	return nil
}

func (r *SQLServerPaymentRepository) Update(ctx context.Context, p *payment.Payment) error {
	query := `UPDATE PAYMENT
	 SET ID_ORDER = ?, ID_PAYMENT_METHOD = ?, INSTALLMENTS_QUANTITY = ?,
	     DUE_DATE = ?, PAYMENT_DATE = ?, VALUE = ?
	 WHERE ID_PAYMENT = ?`
	_, err := r.db.ExecContext(ctx, query,
		p.IDOrder, p.IDPaymentMethod, p.InstallmentsQuantity, p.DueDate, p.PaymentDate, p.Value, p.IDPayment,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", p.IDPayment), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerPaymentRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM PAYMENT WHERE ID_PAYMENT = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

