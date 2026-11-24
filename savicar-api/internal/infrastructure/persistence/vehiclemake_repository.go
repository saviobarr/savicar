package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/vehiclemake"
)

type SQLServerVehicleMakeRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerVehicleMakeRepository(db *sql.DB) *SQLServerVehicleMakeRepository {
	return &SQLServerVehicleMakeRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.make"),
	}
}

func (r *SQLServerVehicleMakeRepository) FindAll(ctx context.Context) ([]vehiclemake.VehicleMake, error) {
	query := "SELECT ID_MAKE, NAME, TYPE FROM MAKE"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []vehiclemake.VehicleMake
	for rows.Next() {
		var m vehiclemake.VehicleMake
		if err := rows.Scan(&m.IDMake, &m.Name, &m.Type); err != nil {
			return nil, err
		}
		m.Name = trimStringPtr(m.Name)
		result = append(result, m)
	}
	return result, rows.Err()
}

func (r *SQLServerVehicleMakeRepository) FindByType(ctx context.Context, tipo int) ([]vehiclemake.VehicleMake, error) {
	query := "SELECT ID_MAKE, NAME, TYPE FROM MAKE WHERE TYPE = ?"
	rows, err := r.db.QueryContext(ctx, query, tipo)
	if err != nil {
		r.log.ErrorContext(ctx, "FindByType failed", slog.Int("tipo", tipo), slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []vehiclemake.VehicleMake
	for rows.Next() {
		var m vehiclemake.VehicleMake
		if err := rows.Scan(&m.IDMake, &m.Name, &m.Type); err != nil {
			return nil, err
		}
		m.Name = trimStringPtr(m.Name)
		result = append(result, m)
	}
	return result, rows.Err()
}

func (r *SQLServerVehicleMakeRepository) FindByID(ctx context.Context, id int) (*vehiclemake.VehicleMake, error) {
	query := "SELECT ID_MAKE, NAME, TYPE FROM MAKE WHERE ID_MAKE = ?"
	var m vehiclemake.VehicleMake
	err := r.db.QueryRowContext(ctx, query, id).Scan(&m.IDMake, &m.Name, &m.Type)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	m.Name = trimStringPtr(m.Name)
	return &m, nil
}

func (r *SQLServerVehicleMakeRepository) Create(ctx context.Context, m *vehiclemake.VehicleMake) error {
	query := "INSERT INTO MAKE (NAME, TYPE) VALUES (?, ?)"
	r.log.InfoContext(ctx, "insert", slog.String("sql", query), slog.Any("args", []any{m.Name, m.Type}))
	result, err := r.db.ExecContext(ctx, query, m.Name, m.Type)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	m.IDMake = int(id)
	return nil
}

func (r *SQLServerVehicleMakeRepository) Update(ctx context.Context, m *vehiclemake.VehicleMake) error {
	_, err := r.db.ExecContext(ctx, "UPDATE MAKE SET NAME = ?, TYPE = ? WHERE ID_MAKE = ?", m.Name, m.Type, m.IDMake)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", m.IDMake), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerVehicleMakeRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM MAKE WHERE ID_MAKE = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

