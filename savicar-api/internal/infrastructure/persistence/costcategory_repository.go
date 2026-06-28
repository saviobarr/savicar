package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/costcategory"
)

type SQLServerCostCategoryRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerCostCategoryRepository(db *sql.DB) *SQLServerCostCategoryRepository {
	return &SQLServerCostCategoryRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.costcategory"),
	}
}

func (r *SQLServerCostCategoryRepository) FindAll(ctx context.Context) ([]costcategory.CostCategory, error) {
	query := "SELECT ID_COST_CATEGORY, NAME, TYPE, DESCRIPTION FROM COST_CATEGORY ORDER BY NAME"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	result := []costcategory.CostCategory{}
	for rows.Next() {
		var c costcategory.CostCategory
		if err := rows.Scan(&c.IDCostCategory, &c.Name, &c.Type, &c.Description); err != nil {
			return nil, err
		}
		c.Name = trimStringPtr(c.Name)
		c.Description = trimStringPtr(c.Description)
		result = append(result, c)
	}
	return result, rows.Err()
}

func (r *SQLServerCostCategoryRepository) FindByID(ctx context.Context, id int) (*costcategory.CostCategory, error) {
	query := "SELECT ID_COST_CATEGORY, NAME, TYPE, DESCRIPTION FROM COST_CATEGORY WHERE ID_COST_CATEGORY = ?"
	var c costcategory.CostCategory
	err := r.db.QueryRowContext(ctx, query, id).Scan(&c.IDCostCategory, &c.Name, &c.Type, &c.Description)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	c.Name = trimStringPtr(c.Name)
	c.Description = trimStringPtr(c.Description)
	return &c, nil
}

func (r *SQLServerCostCategoryRepository) Create(ctx context.Context, c *costcategory.CostCategory) error {
	result, err := r.db.ExecContext(ctx,
		"INSERT INTO COST_CATEGORY (NAME, TYPE, DESCRIPTION) VALUES (?, ?, ?)",
		derefString(c.Name), derefInt(c.Type), derefString(c.Description),
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	c.IDCostCategory = int(id)
	return nil
}

func (r *SQLServerCostCategoryRepository) Update(ctx context.Context, c *costcategory.CostCategory) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE COST_CATEGORY SET NAME = ?, TYPE = ?, DESCRIPTION = ? WHERE ID_COST_CATEGORY = ?",
		derefString(c.Name), derefInt(c.Type), derefString(c.Description), c.IDCostCategory,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", c.IDCostCategory), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerCostCategoryRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM COST_CATEGORY WHERE ID_COST_CATEGORY = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

