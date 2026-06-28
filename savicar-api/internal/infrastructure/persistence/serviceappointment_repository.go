package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/serviceappointment"
)

type SQLServerServiceAppointmentRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerServiceAppointmentRepository(db *sql.DB) *SQLServerServiceAppointmentRepository {
	return &SQLServerServiceAppointmentRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.serviceappointment"),
	}
}

const saSelectCols = `
	sa.ID_SERVICE_APPOINTMENT, sa.ID_CUSTOMER_MODEL, sa.START_AT, sa.END_AT, sa.STATUS, sa.NOTES,
	cm.ID_CUSTOMER,
	COALESCE(NULLIF(c.INDIVIDUAL_NAME, ''), NULLIF(c.TRADE_NAME, ''), NULLIF(c.LEGAL_NAME, '')),
	m.NAME, cm.PLATE`

const saJoins = `
	FROM SERVICE_APPOINTMENT sa
	LEFT JOIN CUSTOMER_MODEL cm ON cm.ID_CUSTOMER_MODEL = sa.ID_CUSTOMER_MODEL
	LEFT JOIN CUSTOMER c ON c.ID_CUSTOMER = cm.ID_CUSTOMER
	LEFT JOIN MODEL m ON m.ID_MODEL = cm.ID_MODEL`

func scanSA(row interface {
	Scan(dest ...any) error
}, sa *serviceappointment.ServiceAppointment) error {
	return row.Scan(
		&sa.IDServiceAppointment, &sa.IDCustomerModel,
		&sa.StartAt, &sa.EndAt, &sa.Status, &sa.Notes,
		&sa.IDCustomer,
		&sa.CustomerName, &sa.ModelName, &sa.PlateNumber,
	)
}

func trimSA(sa *serviceappointment.ServiceAppointment) {
	sa.StartAt = trimStringPtr(sa.StartAt)
	sa.EndAt = trimStringPtr(sa.EndAt)
	sa.Notes = trimStringPtr(sa.Notes)
	sa.CustomerName = trimStringPtr(sa.CustomerName)
	sa.ModelName = trimStringPtr(sa.ModelName)
	sa.PlateNumber = trimStringPtr(sa.PlateNumber)
}

func (r *SQLServerServiceAppointmentRepository) FindAll(ctx context.Context) ([]serviceappointment.ServiceAppointment, error) {
	query := `SELECT` + saSelectCols + saJoins + ` ORDER BY sa.START_AT ASC`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []serviceappointment.ServiceAppointment
	for rows.Next() {
		var sa serviceappointment.ServiceAppointment
		if err := scanSA(rows, &sa); err != nil {
			return nil, err
		}
		trimSA(&sa)
		result = append(result, sa)
	}
	return result, rows.Err()
}

func (r *SQLServerServiceAppointmentRepository) FindByID(ctx context.Context, id int) (*serviceappointment.ServiceAppointment, error) {
	query := `SELECT` + saSelectCols + saJoins + ` WHERE sa.ID_SERVICE_APPOINTMENT = ?`
	var sa serviceappointment.ServiceAppointment
	err := scanSA(r.db.QueryRowContext(ctx, query, id), &sa)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	trimSA(&sa)
	return &sa, nil
}

func (r *SQLServerServiceAppointmentRepository) Create(ctx context.Context, sa *serviceappointment.ServiceAppointment) error {
	result, err := r.db.ExecContext(ctx,
		`INSERT INTO SERVICE_APPOINTMENT (ID_CUSTOMER_MODEL, START_AT, END_AT, STATUS, NOTES)
		 VALUES (?, ?, ?, ?, ?)`,
		sa.IDCustomerModel, sa.StartAt, sa.EndAt, sa.Status, sa.Notes,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	sa.IDServiceAppointment = int(id)
	return nil
}

func (r *SQLServerServiceAppointmentRepository) Update(ctx context.Context, sa *serviceappointment.ServiceAppointment) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE SERVICE_APPOINTMENT
		 SET ID_CUSTOMER_MODEL = ?, START_AT = ?, END_AT = ?, STATUS = ?, NOTES = ?
		 WHERE ID_SERVICE_APPOINTMENT = ?`,
		sa.IDCustomerModel, sa.StartAt, sa.EndAt, sa.Status, sa.Notes,
		sa.IDServiceAppointment,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", sa.IDServiceAppointment), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerServiceAppointmentRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM SERVICE_APPOINTMENT WHERE ID_SERVICE_APPOINTMENT = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

