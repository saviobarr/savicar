package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/resource"
)

type SQLServerResourceRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerResourceRepository(db *sql.DB) *SQLServerResourceRepository {
	return &SQLServerResourceRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.resource"),
	}
}

func (r *SQLServerResourceRepository) FindAll(ctx context.Context) ([]resource.Resource, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT ID_RESOURCE, DESCRIPTION FROM RESOURCES ORDER BY DESCRIPTION")
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []resource.Resource
	for rows.Next() {
		var res resource.Resource
		if err := rows.Scan(&res.IDResource, &res.Description); err != nil {
			return nil, err
		}
		res.Description = trimStringPtr(res.Description)
		result = append(result, res)
	}
	return result, rows.Err()
}

func (r *SQLServerResourceRepository) FindByID(ctx context.Context, id int) (*resource.Resource, error) {
	var res resource.Resource
	err := r.db.QueryRowContext(ctx,
		"SELECT ID_RESOURCE, DESCRIPTION FROM RESOURCES WHERE ID_RESOURCE = ?", id,
	).Scan(&res.IDResource, &res.Description)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	res.Description = trimStringPtr(res.Description)
	return &res, nil
}

func (r *SQLServerResourceRepository) Create(ctx context.Context, res *resource.Resource) error {
	result, err := r.db.ExecContext(ctx,
		"INSERT INTO RESOURCES (DESCRIPTION) VALUES (?)", res.Description,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	res.IDResource = int(id)
	return nil
}

func (r *SQLServerResourceRepository) Update(ctx context.Context, res *resource.Resource) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE RESOURCES SET DESCRIPTION = ? WHERE ID_RESOURCE = ?",
		res.Description, res.IDResource,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", res.IDResource), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerResourceRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM RESOURCES WHERE ID_RESOURCE = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

