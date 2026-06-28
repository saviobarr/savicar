package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/operationalcosts"
)

type SQLServerOperationalCostsRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerOperationalCostsRepository(db *sql.DB) *SQLServerOperationalCostsRepository {
	return &SQLServerOperationalCostsRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.operationalcosts"),
	}
}

const selectFields = `
	ID_COST, ID_COST_CATEGORY, DESCRIPTION, AMOUNT, RECURRENCE,
	DATE_FORMAT(REFERENCE_DATE, '%Y-%m-%d'), DUE_DAY, ID_ORDER,
	DATE_FORMAT(CREATED_AT, '%Y-%m-%d %H:%i:%s')
`

func (r *SQLServerOperationalCostsRepository) scan(row interface {
	Scan(...any) error
}) (*operationalcosts.OperationalCost, error) {
	var c operationalcosts.OperationalCost
	err := row.Scan(
		&c.IDCost,
		&c.IDCostCategory,
		&c.Description,
		&c.Amount,
		&c.Recurrence,
		&c.ReferenceDate,
		&c.DueDay,
		&c.IDOrder,
		&c.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	c.Description = trimStringPtr(c.Description)
	c.ReferenceDate = trimStringPtr(c.ReferenceDate)
	c.CreatedAt = trimStringPtr(c.CreatedAt)
	return &c, nil
}

func (r *SQLServerOperationalCostsRepository) FindAll(ctx context.Context) ([]operationalcosts.OperationalCost, error) {
	query := "SELECT " + selectFields + " FROM OPERATIONAL_COSTS ORDER BY ID_COST"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	result := []operationalcosts.OperationalCost{}
	for rows.Next() {
		c, err := r.scan(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, *c)
	}
	return result, rows.Err()
}

func (r *SQLServerOperationalCostsRepository) FindByID(ctx context.Context, id int) (*operationalcosts.OperationalCost, error) {
	query := "SELECT " + selectFields + " FROM OPERATIONAL_COSTS WHERE ID_COST = ?"
	row := r.db.QueryRowContext(ctx, query, id)
	c, err := r.scan(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	return c, nil
}

func (r *SQLServerOperationalCostsRepository) Create(ctx context.Context, c *operationalcosts.OperationalCost) error {
	query := `
		INSERT INTO OPERATIONAL_COSTS (ID_COST_CATEGORY, DESCRIPTION, AMOUNT, RECURRENCE, REFERENCE_DATE, DUE_DAY, ID_ORDER)
		VALUES (?, ?, ?, ?, ?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query,
		derefInt(c.IDCostCategory),
		derefString(c.Description),
		c.Amount,
		derefInt(c.Recurrence),
		derefString(c.ReferenceDate),
		derefInt(c.DueDay),
		derefInt(c.IDOrder),
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	c.IDCost = int(id)
	return nil
}

func (r *SQLServerOperationalCostsRepository) Update(ctx context.Context, c *operationalcosts.OperationalCost) error {
	query := `
		UPDATE OPERATIONAL_COSTS
		SET ID_COST_CATEGORY = ?, DESCRIPTION = ?, AMOUNT = ?, RECURRENCE = ?, REFERENCE_DATE = ?, DUE_DAY = ?, ID_ORDER = ?
		WHERE ID_COST = ?`
	_, err := r.db.ExecContext(ctx, query,
		derefInt(c.IDCostCategory),
		derefString(c.Description),
		c.Amount,
		derefInt(c.Recurrence),
		derefString(c.ReferenceDate),
		derefInt(c.DueDay),
		derefInt(c.IDOrder),
		c.IDCost,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", c.IDCost), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerOperationalCostsRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM OPERATIONAL_COSTS WHERE ID_COST = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

