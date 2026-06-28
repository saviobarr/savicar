package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/country"
)

type SQLServerCountryRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerCountryRepository(db *sql.DB) *SQLServerCountryRepository {
	return &SQLServerCountryRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.country"),
	}
}

func (r *SQLServerCountryRepository) FindAll(ctx context.Context) ([]country.Country, error) {
	query := "SELECT ID_COUNTRY, NAME, ABBREVIATION FROM COUNTRY ORDER BY NAME"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []country.Country
	for rows.Next() {
		var c country.Country
		if err := rows.Scan(&c.IDCountry, &c.Name, &c.Abbreviation); err != nil {
			return nil, err
		}
		c.Name = trimStringPtr(c.Name)
		c.Abbreviation = trimStringPtr(c.Abbreviation)
		result = append(result, c)
	}
	return result, rows.Err()
}

func (r *SQLServerCountryRepository) FindByID(ctx context.Context, id int) (*country.Country, error) {
	query := "SELECT ID_COUNTRY, NAME, ABBREVIATION FROM COUNTRY WHERE ID_COUNTRY = ?"
	var c country.Country
	err := r.db.QueryRowContext(ctx, query, id).Scan(&c.IDCountry, &c.Name, &c.Abbreviation)
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

func (r *SQLServerCountryRepository) Create(ctx context.Context, c *country.Country) error {
	query := "INSERT INTO COUNTRY (NAME, ABBREVIATION) VALUES (?, ?)"
	result, err := r.db.ExecContext(ctx, query, c.Name, c.Abbreviation)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	c.IDCountry = int(id)
	return nil
}

func (r *SQLServerCountryRepository) Update(ctx context.Context, c *country.Country) error {
	query := "UPDATE COUNTRY SET NAME = ?, ABBREVIATION = ? WHERE ID_COUNTRY = ?"
	_, err := r.db.ExecContext(ctx, query, c.Name, c.Abbreviation, c.IDCountry)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", c.IDCountry), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerCountryRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM COUNTRY WHERE ID_COUNTRY = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

