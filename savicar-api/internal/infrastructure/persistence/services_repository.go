package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/services"
)

type SQLServerServicesRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerServicesRepository(db *sql.DB) *SQLServerServicesRepository {
	return &SQLServerServicesRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.services"),
	}
}

func (r *SQLServerServicesRepository) FindAll(ctx context.Context) ([]services.Service, error) {
	query := `
		SELECT s.ID_SERVICE, s.CODE, s.DESCRICAO, s.HOURS_QUANTITY, s.UNIT_VALUE, s.TOTAL_VALUE,
		       s.ID_ORDER, s.ID_TECHNICIAN, t.NAME, s.STATUS
		FROM SERVICES s
		LEFT JOIN TECHNICIAN t ON t.ID_TECHNICIAN = s.ID_TECHNICIAN`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []services.Service
	for rows.Next() {
		var s services.Service
		if err := rows.Scan(&s.IDService, &s.Code, &s.Description, &s.HoursQuantity, &s.UnitValue, &s.TotalValue, &s.IDOrder, &s.IDTechnician, &s.TechnicianName, &s.Status); err != nil {
			return nil, err
		}
		s.Code = trimStringPtr(s.Code)
		s.Description = trimStringPtr(s.Description)
		s.TechnicianName = trimStringPtr(s.TechnicianName)
		result = append(result, s)
	}
	return result, rows.Err()
}

func (r *SQLServerServicesRepository) FindByID(ctx context.Context, id int) (*services.Service, error) {
	query := `
		SELECT s.ID_SERVICE, s.CODE, s.DESCRICAO, s.HOURS_QUANTITY, s.UNIT_VALUE, s.TOTAL_VALUE,
		       s.ID_ORDER, s.ID_TECHNICIAN, t.NAME, s.STATUS
		FROM SERVICES s
		LEFT JOIN TECHNICIAN t ON t.ID_TECHNICIAN = s.ID_TECHNICIAN
		WHERE s.ID_SERVICE = ?`
	var s services.Service
	err := r.db.QueryRowContext(ctx, query, id).Scan(&s.IDService, &s.Code, &s.Description, &s.HoursQuantity, &s.UnitValue, &s.TotalValue, &s.IDOrder, &s.IDTechnician, &s.TechnicianName, &s.Status)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	s.Code = trimStringPtr(s.Code)
	s.Description = trimStringPtr(s.Description)
	s.TechnicianName = trimStringPtr(s.TechnicianName)
	return &s, nil
}

func (r *SQLServerServicesRepository) Create(ctx context.Context, s *services.Service) error {
	query := "INSERT INTO SERVICES (CODE, DESCRICAO, HOURS_QUANTITY, UNIT_VALUE, TOTAL_VALUE, ID_ORDER, ID_TECHNICIAN, STATUS) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
	result, err := r.db.ExecContext(ctx, query, s.Code, s.Description, s.HoursQuantity, s.UnitValue, s.TotalValue, s.IDOrder, derefInt(s.IDTechnician), derefInt(s.Status))
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	s.IDService = int(id)
	return nil
}

func (r *SQLServerServicesRepository) Update(ctx context.Context, s *services.Service) error {
	query := `UPDATE SERVICES
	 SET CODE = ?, DESCRICAO = ?, HOURS_QUANTITY = ?, UNIT_VALUE = ?, TOTAL_VALUE = ?, ID_ORDER = ?, ID_TECHNICIAN = ?, STATUS = ?
	 WHERE ID_SERVICE = ?`
	_, err := r.db.ExecContext(ctx, query, s.Code, s.Description, s.HoursQuantity, s.UnitValue, s.TotalValue, s.IDOrder, derefInt(s.IDTechnician), derefInt(s.Status), s.IDService)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", s.IDService), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerServicesRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM SERVICES WHERE ID_SERVICE = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

