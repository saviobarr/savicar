package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/customermodel"
)

type SQLServerCustomerModelRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerCustomerModelRepository(db *sql.DB) *SQLServerCustomerModelRepository {
	return &SQLServerCustomerModelRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.customermodel"),
	}
}

func (r *SQLServerCustomerModelRepository) FindAll(ctx context.Context) ([]customermodel.CustomerModel, error) {
	query := `SELECT cm.ID_CUSTOMER_MODEL, cm.ID_CUSTOMER, cm.ID_MODEL, m.NAME,
	 COALESCE(NULLIF(c.INDIVIDUAL_NAME, ''), NULLIF(c.TRADE_NAME, ''), NULLIF(c.LEGAL_NAME, '')),
	 cm.PLATE, cm.YEAR_MAKE, cm.YEAR_MODEL, cm.COLOR, cm.VIN
	 FROM CUSTOMER_MODEL cm
	 LEFT JOIN MODEL m ON m.ID_MODEL = cm.ID_MODEL
	 LEFT JOIN CUSTOMER c ON c.ID_CUSTOMER = cm.ID_CUSTOMER`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []customermodel.CustomerModel
	for rows.Next() {
		var cm customermodel.CustomerModel
		if err := rows.Scan(&cm.IDCustomerModel, &cm.IDCustomer, &cm.IDModel, &cm.ModelName, &cm.CustomerName, &cm.Plate, &cm.YearMake, &cm.YearModel, &cm.Color, &cm.VIN); err != nil {
			return nil, err
		}
		cm.ModelName = trimStringPtr(cm.ModelName)
		cm.CustomerName = trimStringPtr(cm.CustomerName)
		cm.Plate = trimStringPtr(cm.Plate)
		cm.Color = trimStringPtr(cm.Color)
		cm.VIN = trimStringPtr(cm.VIN)
		result = append(result, cm)
	}
	return result, rows.Err()
}

func (r *SQLServerCustomerModelRepository) FindByID(ctx context.Context, id int) (*customermodel.CustomerModel, error) {
	query := `SELECT ID_CUSTOMER_MODEL, ID_CUSTOMER, ID_MODEL, PLATE, YEAR_MAKE, YEAR_MODEL, COLOR, VIN
	 FROM CUSTOMER_MODEL WHERE ID_CUSTOMER_MODEL = ?`
	var cm customermodel.CustomerModel
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&cm.IDCustomerModel, &cm.IDCustomer, &cm.IDModel, &cm.Plate, &cm.YearMake, &cm.YearModel, &cm.Color, &cm.VIN,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	cm.Plate = trimStringPtr(cm.Plate)
	cm.Color = trimStringPtr(cm.Color)
	cm.VIN = trimStringPtr(cm.VIN)
	return &cm, nil
}

func (r *SQLServerCustomerModelRepository) Create(ctx context.Context, cm *customermodel.CustomerModel) error {
	query := `INSERT INTO CUSTOMER_MODEL (ID_CUSTOMER, ID_MODEL, PLATE, YEAR_MAKE, YEAR_MODEL, COLOR, VIN)
	 VALUES (?, ?, ?, ?, ?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query, cm.IDCustomer, cm.IDModel, cm.Plate, cm.YearMake, cm.YearModel, cm.Color, cm.VIN)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	cm.IDCustomerModel = int(id)
	return nil
}

func (r *SQLServerCustomerModelRepository) Update(ctx context.Context, cm *customermodel.CustomerModel) error {
	query := `UPDATE CUSTOMER_MODEL
	 SET ID_CUSTOMER = ?, ID_MODEL = ?, PLATE = ?, YEAR_MAKE = ?, YEAR_MODEL = ?, COLOR = ?, VIN = ?
	 WHERE ID_CUSTOMER_MODEL = ?`
	_, err := r.db.ExecContext(ctx, query, cm.IDCustomer, cm.IDModel, cm.Plate, cm.YearMake, cm.YearModel, cm.Color, cm.VIN, cm.IDCustomerModel)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", cm.IDCustomerModel), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerCustomerModelRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM CUSTOMER_MODEL WHERE ID_CUSTOMER_MODEL = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

