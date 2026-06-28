package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/vehiclemodel"
)

type SQLServerVehicleModelRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerVehicleModelRepository(db *sql.DB) *SQLServerVehicleModelRepository {
	return &SQLServerVehicleModelRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.vehiclemodel"),
	}
}

func (r *SQLServerVehicleModelRepository) FindAll(ctx context.Context) ([]vehiclemodel.VehicleModel, error) {
	query := "SELECT ID_MODEL, ID_MAKE, NAME, VERSION, ID_FUEL FROM MODEL"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []vehiclemodel.VehicleModel
	for rows.Next() {
		var m vehiclemodel.VehicleModel
		if err := rows.Scan(&m.IDModel, &m.IDMake, &m.Name, &m.Version, &m.IDFuel); err != nil {
			return nil, err
		}
		m.Name = trimStringPtr(m.Name)
		m.Version = trimStringPtr(m.Version)
		result = append(result, m)
	}
	return result, rows.Err()
}

func (r *SQLServerVehicleModelRepository) FindByID(ctx context.Context, id int) (*vehiclemodel.VehicleModel, error) {
	query := "SELECT ID_MODEL, ID_MAKE, NAME, VERSION, ID_FUEL FROM MODEL WHERE ID_MODEL = ?"
	var m vehiclemodel.VehicleModel
	err := r.db.QueryRowContext(ctx, query, id).Scan(&m.IDModel, &m.IDMake, &m.Name, &m.Version, &m.IDFuel)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	m.Name = trimStringPtr(m.Name)
	m.Version = trimStringPtr(m.Version)
	return &m, nil
}

func (r *SQLServerVehicleModelRepository) Create(ctx context.Context, m *vehiclemodel.VehicleModel) error {
	query := "INSERT INTO MODEL (ID_MAKE, NAME, VERSION, ID_FUEL) VALUES (?, ?, ?, ?)"
	result, err := r.db.ExecContext(ctx, query, m.IDMake, m.Name, m.Version, m.IDFuel)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	m.IDModel = int(id)
	return nil
}

func (r *SQLServerVehicleModelRepository) Update(ctx context.Context, m *vehiclemodel.VehicleModel) error {
	query := "UPDATE MODEL SET ID_MAKE = ?, NAME = ?, VERSION = ?, ID_FUEL = ? WHERE ID_MODEL = ?"
	_, err := r.db.ExecContext(ctx, query, m.IDMake, m.Name, m.Version, m.IDFuel, m.IDModel)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", m.IDModel), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerVehicleModelRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM MODEL WHERE ID_MODEL = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

