package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/unity"
)

type SQLServerUnityRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerUnityRepository(db *sql.DB) *SQLServerUnityRepository {
	return &SQLServerUnityRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.unity"),
	}
}

func (r *SQLServerUnityRepository) FindAll(ctx context.Context) ([]unity.Unity, error) {
	query := "SELECT ID_UNIT, DESCRIPTION FROM UNIT ORDER BY DESCRIPTION"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []unity.Unity
	for rows.Next() {
		var u unity.Unity
		if err := rows.Scan(&u.IDUnity, &u.Description); err != nil {
			return nil, err
		}
		u.Description = trimStringPtr(u.Description)
		result = append(result, u)
	}
	return result, rows.Err()
}

func (r *SQLServerUnityRepository) FindByID(ctx context.Context, id int) (*unity.Unity, error) {
	query := "SELECT ID_UNIT, DESCRIPTION FROM UNIT WHERE ID_UNIT = ?"
	var u unity.Unity
	err := r.db.QueryRowContext(ctx, query, id).Scan(&u.IDUnity, &u.Description)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	u.Description = trimStringPtr(u.Description)
	return &u, nil
}

func (r *SQLServerUnityRepository) Create(ctx context.Context, u *unity.Unity) error {
	query := "INSERT INTO UNIT (DESCRIPTION) VALUES (?)"
	result, err := r.db.ExecContext(ctx, query, u.Description)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	u.IDUnity = int(id)
	return nil
}

func (r *SQLServerUnityRepository) Update(ctx context.Context, u *unity.Unity) error {
	query := "UPDATE UNIT SET DESCRIPTION = ? WHERE ID_UNIT = ?"
	_, err := r.db.ExecContext(ctx, query, u.Description, u.IDUnity)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", u.IDUnity), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerUnityRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM UNIT WHERE ID_UNIT = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

