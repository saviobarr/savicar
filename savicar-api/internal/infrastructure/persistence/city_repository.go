package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/city"
)

type SQLServerCityRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerCityRepository(db *sql.DB) *SQLServerCityRepository {
	return &SQLServerCityRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.city"),
	}
}

func (r *SQLServerCityRepository) FindAll(ctx context.Context) ([]city.City, error) {
	query := "SELECT ID_CITY, ID_STATE, NAME, ABBREVIATION FROM CITY ORDER BY NAME"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []city.City
	for rows.Next() {
		var c city.City
		if err := rows.Scan(&c.IDCity, &c.IDState, &c.Name, &c.Abbreviation); err != nil {
			return nil, err
		}
		c.Name = trimStringPtr(c.Name)
		c.Abbreviation = trimStringPtr(c.Abbreviation)
		result = append(result, c)
	}
	return result, rows.Err()
}

func (r *SQLServerCityRepository) FindByID(ctx context.Context, id int) (*city.City, error) {
	query := "SELECT ID_CITY, ID_STATE, NAME, ABBREVIATION FROM CITY WHERE ID_CITY = ?"
	var c city.City
	err := r.db.QueryRowContext(ctx, query, id).Scan(&c.IDCity, &c.IDState, &c.Name, &c.Abbreviation)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	c.Name = trimStringPtr(c.Name)
	c.Abbreviation = trimStringPtr(c.Abbreviation)
	return &c, nil
}

func (r *SQLServerCityRepository) Create(ctx context.Context, c *city.City) error {
	query := "INSERT INTO CITY (ID_STATE, NAME, ABBREVIATION) VALUES (?, ?, ?)"
	result, err := r.db.ExecContext(ctx, query, c.IDState, c.Name, c.Abbreviation)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	c.IDCity = int(id)
	return nil
}

func (r *SQLServerCityRepository) Update(ctx context.Context, c *city.City) error {
	query := "UPDATE CITY SET ID_STATE = ?, NAME = ?, ABBREVIATION = ? WHERE ID_CITY = ?"
	_, err := r.db.ExecContext(ctx, query, c.IDState, c.Name, c.Abbreviation, c.IDCity)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", c.IDCity), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerCityRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM CITY WHERE ID_CITY = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

