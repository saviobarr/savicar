package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/technician"
)

type SQLServerTechnicianRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerTechnicianRepository(db *sql.DB) *SQLServerTechnicianRepository {
	return &SQLServerTechnicianRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.technician"),
	}
}

func (r *SQLServerTechnicianRepository) FindAll(ctx context.Context) ([]technician.Technician, error) {
	query := "SELECT ID_TECHNICIAN, NAME, SALARY, PERCENT, ID_USER FROM TECHNICIAN"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []technician.Technician
	for rows.Next() {
		var t technician.Technician
		if err := rows.Scan(&t.IDTechnician, &t.Name, &t.Salary, &t.Percent, &t.IDUser); err != nil {
			return nil, err
		}
		t.Name = trimStringPtr(t.Name)
		result = append(result, t)
	}
	return result, rows.Err()
}

func (r *SQLServerTechnicianRepository) FindByID(ctx context.Context, id int) (*technician.Technician, error) {
	query := "SELECT ID_TECHNICIAN, NAME, SALARY, PERCENT, ID_USER FROM TECHNICIAN WHERE ID_TECHNICIAN = ?"
	var t technician.Technician
	err := r.db.QueryRowContext(ctx, query, id).Scan(&t.IDTechnician, &t.Name, &t.Salary, &t.Percent, &t.IDUser)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	t.Name = trimStringPtr(t.Name)
	return &t, nil
}

func (r *SQLServerTechnicianRepository) Create(ctx context.Context, t *technician.Technician) error {
	result, err := r.db.ExecContext(ctx, "INSERT INTO TECHNICIAN (NAME, SALARY, PERCENT, ID_USER) VALUES (?, ?, ?, ?)", t.Name, t.Salary, t.Percent, t.IDUser)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	t.IDTechnician = int(id)
	return nil
}

func (r *SQLServerTechnicianRepository) Update(ctx context.Context, t *technician.Technician) error {
	_, err := r.db.ExecContext(ctx, "UPDATE TECHNICIAN SET NAME = ?, SALARY = ?, PERCENT = ?, ID_USER = ? WHERE ID_TECHNICIAN = ?", t.Name, t.Salary, t.Percent, t.IDUser, t.IDTechnician)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", t.IDTechnician), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerTechnicianRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM TECHNICIAN WHERE ID_TECHNICIAN = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

