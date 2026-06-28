package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/state"
)

type SQLServerStateRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerStateRepository(db *sql.DB) *SQLServerStateRepository {
	return &SQLServerStateRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.state"),
	}
}

func (r *SQLServerStateRepository) FindAll(ctx context.Context) ([]state.State, error) {
	query := "SELECT ID_STATE, ID_COUNTRY, NAME, ABBREVIATION FROM STATE ORDER BY NAME"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []state.State
	for rows.Next() {
		var s state.State
		if err := rows.Scan(&s.IDState, &s.IDCountry, &s.Name, &s.Abbreviation); err != nil {
			return nil, err
		}
		s.Name = trimStringPtr(s.Name)
		s.Abbreviation = trimStringPtr(s.Abbreviation)
		result = append(result, s)
	}
	return result, rows.Err()
}

func (r *SQLServerStateRepository) FindByID(ctx context.Context, id int) (*state.State, error) {
	query := "SELECT ID_STATE, ID_COUNTRY, NAME, ABBREVIATION FROM STATE WHERE ID_STATE = ?"
	var s state.State
	err := r.db.QueryRowContext(ctx, query, id).Scan(&s.IDState, &s.IDCountry, &s.Name, &s.Abbreviation)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	s.Name = trimStringPtr(s.Name)
	s.Abbreviation = trimStringPtr(s.Abbreviation)
	return &s, nil
}

func (r *SQLServerStateRepository) Create(ctx context.Context, s *state.State) error {
	query := "INSERT INTO STATE (ID_COUNTRY, NAME, ABBREVIATION) VALUES (?, ?, ?)"
	result, err := r.db.ExecContext(ctx, query, s.IDCountry, s.Name, s.Abbreviation)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	s.IDState = int(id)
	return nil
}

func (r *SQLServerStateRepository) Update(ctx context.Context, s *state.State) error {
	query := "UPDATE STATE SET ID_COUNTRY = ?, NAME = ?, ABBREVIATION = ? WHERE ID_STATE = ?"
	_, err := r.db.ExecContext(ctx, query, s.IDCountry, s.Name, s.Abbreviation, s.IDState)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", s.IDState), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerStateRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM STATE WHERE ID_STATE = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

