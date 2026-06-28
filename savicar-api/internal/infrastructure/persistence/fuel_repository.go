package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/fuel"
)

type SQLServerFuelRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerFuelRepository(db *sql.DB) *SQLServerFuelRepository {
	return &SQLServerFuelRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.fuel"),
	}
}

func (r *SQLServerFuelRepository) FindAll(ctx context.Context) ([]fuel.Fuel, error) {
	query := "SELECT ID_FUEL, NAME FROM FUEL"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []fuel.Fuel
	for rows.Next() {
		var f fuel.Fuel
		if err := rows.Scan(&f.IDFuel, &f.Name); err != nil {
			return nil, err
		}
		f.Name = trimStringPtr(f.Name)
		result = append(result, f)
	}
	return result, rows.Err()
}

func (r *SQLServerFuelRepository) FindByID(ctx context.Context, id int) (*fuel.Fuel, error) {
	query := "SELECT ID_FUEL, NAME FROM FUEL WHERE ID_FUEL = ?"
	var f fuel.Fuel
	err := r.db.QueryRowContext(ctx, query, id).Scan(&f.IDFuel, &f.Name)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	f.Name = trimStringPtr(f.Name)
	return &f, nil
}

func (r *SQLServerFuelRepository) Create(ctx context.Context, f *fuel.Fuel) error {
	result, err := r.db.ExecContext(ctx, "INSERT INTO FUEL (NAME) VALUES (?)", f.Name)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	f.IDFuel = int(id)
	return nil
}

func (r *SQLServerFuelRepository) Update(ctx context.Context, f *fuel.Fuel) error {
	_, err := r.db.ExecContext(ctx, "UPDATE FUEL SET NAME = ? WHERE ID_FUEL = ?", f.Name, f.IDFuel)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", f.IDFuel), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerFuelRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM FUEL WHERE ID_FUEL = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

