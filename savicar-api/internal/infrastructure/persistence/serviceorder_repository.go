package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/serviceorder"
)

type SQLServerServiceOrderRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerServiceOrderRepository(db *sql.DB) *SQLServerServiceOrderRepository {
	return &SQLServerServiceOrderRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.serviceorder"),
	}
}

func (r *SQLServerServiceOrderRepository) FindAll(ctx context.Context) ([]serviceorder.ServiceOrder, error) {
	query := `SELECT so.ID_ORDER, so.SERVICE_TYPE, so.ID_CUSTOMER_MODEL, so.DATE_TIME_IN, so.DATE_TIME_OUT,
	 cm.PLATE, so.CUSTOMER_NOTES, so.INTERNAL_NOTES, so.ID_CUSTOMER,
	 so.DIAGNOSIS_NOTES, so.ODOMETER_READING, so.ID_USER, t.NAME,
	 COALESCE(NULLIF(c.INDIVIDUAL_NAME, ''), NULLIF(c.TRADE_NAME, ''), NULLIF(c.LEGAL_NAME, '')),
	 (SELECT co.MOBILE_PHONE FROM CONTACT co WHERE co.ID_CUSTOMER = so.ID_CUSTOMER LIMIT 1),
	 m.NAME, so.TOTAL_AMOUNT, so.DISCOUNT, so.FINAL_AMOUNT, so.STATUS
	 FROM SERVICE_ORDER so
	 LEFT JOIN TECHNICIAN t ON t.ID_USER = so.ID_USER
	 LEFT JOIN CUSTOMER c ON c.ID_CUSTOMER = so.ID_CUSTOMER
	 LEFT JOIN CUSTOMER_MODEL cm ON cm.ID_CUSTOMER_MODEL = so.ID_CUSTOMER_MODEL
	 LEFT JOIN MODEL m ON m.ID_MODEL = cm.ID_MODEL`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []serviceorder.ServiceOrder
	for rows.Next() {
		var so serviceorder.ServiceOrder
		if err := rows.Scan(
			&so.IDOrder, &so.ServiceType, &so.IDCustomerModel, &so.DateTimeIn, &so.DateTimeOut, &so.PlateNumber,
			&so.CustomerNotes, &so.InternalNotes, &so.IDCustomer, &so.DiagnosisNotes,
			&so.OdometerReading, &so.IDTechnician, &so.TechnicianName, &so.CustomerName, &so.CustomerPhone,
			&so.ModelName, &so.TotalAmount, &so.Discount, &so.FinalAmount, &so.Status,
		); err != nil {
			return nil, err
		}
		so.DateTimeIn = trimStringPtr(so.DateTimeIn)
		so.DateTimeOut = trimStringPtr(so.DateTimeOut)
		so.PlateNumber = trimStringPtr(so.PlateNumber)
		so.CustomerNotes = trimStringPtr(so.CustomerNotes)
		so.InternalNotes = trimStringPtr(so.InternalNotes)
		so.DiagnosisNotes = trimStringPtr(so.DiagnosisNotes)
		so.TechnicianName = trimStringPtr(so.TechnicianName)
		so.CustomerName = trimStringPtr(so.CustomerName)
		so.ModelName = trimStringPtr(so.ModelName)
		result = append(result, so)
	}
	return result, rows.Err()
}

func (r *SQLServerServiceOrderRepository) FindByID(ctx context.Context, id int) (*serviceorder.ServiceOrder, error) {
	query := `SELECT so.ID_ORDER, so.SERVICE_TYPE, so.ID_CUSTOMER_MODEL, so.DATE_TIME_IN, so.DATE_TIME_OUT,
	 cm.PLATE, so.CUSTOMER_NOTES, so.INTERNAL_NOTES, so.ID_CUSTOMER,
	 so.DIAGNOSIS_NOTES, so.ODOMETER_READING, so.ID_TECHNICIAN, t.NAME,
	 COALESCE(NULLIF(c.INDIVIDUAL_NAME, ''), NULLIF(c.TRADE_NAME, ''), NULLIF(c.LEGAL_NAME, '')),
	 co.MOBILE_PHONE,
	 m.NAME, so.TOTAL_AMOUNT, so.DISCOUNT, so.FINAL_AMOUNT, so.STATUS
	 FROM SERVICE_ORDER so
	 LEFT JOIN TECHNICIAN t ON t.ID_TECHNICIAN = so.ID_TECHNICIAN
	 LEFT JOIN CUSTOMER c ON c.ID_CUSTOMER = so.ID_CUSTOMER
	 LEFT JOIN CONTACT co ON co.ID_CUSTOMER = so.ID_CUSTOMER
	 LEFT JOIN CUSTOMER_MODEL cm ON cm.ID_CUSTOMER_MODEL = so.ID_CUSTOMER_MODEL
	 LEFT JOIN MODEL m ON m.ID_MODEL = cm.ID_MODEL
	 WHERE so.ID_ORDER = ?
	 GROUP BY so.ID_ORDER`
	var so serviceorder.ServiceOrder
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&so.IDOrder, &so.ServiceType, &so.IDCustomerModel, &so.DateTimeIn, &so.DateTimeOut, &so.PlateNumber,
		&so.CustomerNotes, &so.InternalNotes, &so.IDCustomer, &so.DiagnosisNotes,
		&so.OdometerReading, &so.IDTechnician, &so.TechnicianName, &so.CustomerName, &so.CustomerPhone,
		&so.ModelName, &so.TotalAmount, &so.Discount, &so.FinalAmount, &so.Status,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	so.DateTimeIn = trimStringPtr(so.DateTimeIn)
	so.DateTimeOut = trimStringPtr(so.DateTimeOut)
	so.PlateNumber = trimStringPtr(so.PlateNumber)
	so.CustomerNotes = trimStringPtr(so.CustomerNotes)
	so.InternalNotes = trimStringPtr(so.InternalNotes)
	so.DiagnosisNotes = trimStringPtr(so.DiagnosisNotes)
	so.TechnicianName = trimStringPtr(so.TechnicianName)
	so.CustomerName = trimStringPtr(so.CustomerName)
	so.ModelName = trimStringPtr(so.ModelName)
	return &so, nil
}

func (r *SQLServerServiceOrderRepository) Create(ctx context.Context, so *serviceorder.ServiceOrder) error {
	query := `INSERT INTO SERVICE_ORDER
	 (SERVICE_TYPE, ID_CUSTOMER_MODEL, DATE_TIME_IN, DATE_TIME_OUT,
	  CUSTOMER_NOTES, INTERNAL_NOTES, ID_CUSTOMER, DIAGNOSIS_NOTES,
	  ODOMETER_READING, ID_USER, TOTAL_AMOUNT, DISCOUNT, FINAL_AMOUNT, STATUS)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query,
		so.ServiceType, so.IDCustomerModel, so.DateTimeIn, so.DateTimeOut,
		so.CustomerNotes, so.InternalNotes, so.IDCustomer, so.DiagnosisNotes,
		so.OdometerReading, so.IDTechnician, so.TotalAmount, so.Discount, so.FinalAmount,
		derefInt(so.Status),
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	so.IDOrder = int(id)
	return nil
}

func (r *SQLServerServiceOrderRepository) Update(ctx context.Context, so *serviceorder.ServiceOrder) error {
	query := `UPDATE SERVICE_ORDER
	 SET SERVICE_TYPE = ?, ID_CUSTOMER_MODEL = ?, DATE_TIME_IN = ?, DATE_TIME_OUT = ?,
	     CUSTOMER_NOTES = ?, INTERNAL_NOTES = ?,
	     ID_CUSTOMER = ?, DIAGNOSIS_NOTES = ?, ODOMETER_READING = ?,
	     ID_USER = ?, TOTAL_AMOUNT = ?, DISCOUNT = ?, FINAL_AMOUNT = ?, STATUS = ?
	 WHERE ID_ORDER = ?`
	_, err := r.db.ExecContext(ctx, query,
		so.ServiceType, so.IDCustomerModel, so.DateTimeIn, so.DateTimeOut,
		so.CustomerNotes, so.InternalNotes, so.IDCustomer, so.DiagnosisNotes,
		so.OdometerReading, so.IDTechnician, so.TotalAmount, so.Discount, so.FinalAmount,
		derefInt(so.Status), so.IDOrder,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", so.IDOrder), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerServiceOrderRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM SERVICE_ORDER WHERE ID_ORDER = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

