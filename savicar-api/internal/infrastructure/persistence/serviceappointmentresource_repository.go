package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/serviceappointmentresource"
)

type SQLServerServiceAppointmentResourceRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerServiceAppointmentResourceRepository(db *sql.DB) *SQLServerServiceAppointmentResourceRepository {
	return &SQLServerServiceAppointmentResourceRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.serviceappointmentresource"),
	}
}

const sarSelect = `
	SELECT sar.ID_SERVICE_APPOINTMENT_RESOURCES, sar.ID_SERVICE_APPOINTMENT,
	       sar.ID_RESOURCE, sar.ID_TECHNICIAN,
	       r.DESCRIPTION, t.NAME
	FROM SERVICE_APPOINTMENT_RESOURCES sar
	LEFT JOIN RESOURCES r  ON r.ID_RESOURCE   = sar.ID_RESOURCE
	LEFT JOIN TECHNICIAN t ON t.ID_TECHNICIAN = sar.ID_TECHNICIAN`

func scanSAR(row interface {
	Scan(dest ...any) error
}, r *serviceappointmentresource.ServiceAppointmentResource) error {
	return row.Scan(
		&r.IDServiceAppointmentResource, &r.IDServiceAppointment,
		&r.IDResource, &r.IDTechnician,
		&r.ResourceDescription, &r.TechnicianName,
	)
}

func trimSAR(r *serviceappointmentresource.ServiceAppointmentResource) {
	r.ResourceDescription = trimStringPtr(r.ResourceDescription)
	r.TechnicianName = trimStringPtr(r.TechnicianName)
}

func (rep *SQLServerServiceAppointmentResourceRepository) FindByAppointmentID(ctx context.Context, idServiceAppointment int) ([]serviceappointmentresource.ServiceAppointmentResource, error) {
	rows, err := rep.db.QueryContext(ctx, sarSelect+` WHERE sar.ID_SERVICE_APPOINTMENT = ?`, idServiceAppointment)
	if err != nil {
		rep.log.ErrorContext(ctx, "FindByAppointmentID failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []serviceappointmentresource.ServiceAppointmentResource
	for rows.Next() {
		var r serviceappointmentresource.ServiceAppointmentResource
		if err := scanSAR(rows, &r); err != nil {
			return nil, err
		}
		trimSAR(&r)
		result = append(result, r)
	}
	return result, rows.Err()
}

func (rep *SQLServerServiceAppointmentResourceRepository) FindByID(ctx context.Context, id int) (*serviceappointmentresource.ServiceAppointmentResource, error) {
	var r serviceappointmentresource.ServiceAppointmentResource
	err := scanSAR(rep.db.QueryRowContext(ctx, sarSelect+` WHERE sar.ID_SERVICE_APPOINTMENT_RESOURCES = ?`, id), &r)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		rep.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	trimSAR(&r)
	return &r, nil
}

func (rep *SQLServerServiceAppointmentResourceRepository) Create(ctx context.Context, r *serviceappointmentresource.ServiceAppointmentResource) error {
	result, err := rep.db.ExecContext(ctx,
		`INSERT INTO SERVICE_APPOINTMENT_RESOURCES (ID_SERVICE_APPOINTMENT, ID_RESOURCE, ID_TECHNICIAN)
		 VALUES (?, ?, ?)`,
		r.IDServiceAppointment, r.IDResource, r.IDTechnician,
	)
	if err != nil {
		rep.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	r.IDServiceAppointmentResource = int(id)
	return nil
}

func (rep *SQLServerServiceAppointmentResourceRepository) Update(ctx context.Context, r *serviceappointmentresource.ServiceAppointmentResource) error {
	_, err := rep.db.ExecContext(ctx,
		`UPDATE SERVICE_APPOINTMENT_RESOURCES
		 SET ID_SERVICE_APPOINTMENT = ?, ID_RESOURCE = ?, ID_TECHNICIAN = ?
		 WHERE ID_SERVICE_APPOINTMENT_RESOURCES = ?`,
		r.IDServiceAppointment, r.IDResource, r.IDTechnician,
		r.IDServiceAppointmentResource,
	)
	if err != nil {
		rep.log.ErrorContext(ctx, "Update failed", slog.Int("id", r.IDServiceAppointmentResource), slog.Any("error", err))
	}
	return err
}

func (rep *SQLServerServiceAppointmentResourceRepository) Delete(ctx context.Context, id int) error {
	_, err := rep.db.ExecContext(ctx,
		`DELETE FROM SERVICE_APPOINTMENT_RESOURCES WHERE ID_SERVICE_APPOINTMENT_RESOURCES = ?`, id,
	)
	if err != nil {
		rep.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

func (rep *SQLServerServiceAppointmentResourceRepository) DeleteByAppointmentID(ctx context.Context, idServiceAppointment int) error {
	_, err := rep.db.ExecContext(ctx,
		`DELETE FROM SERVICE_APPOINTMENT_RESOURCES WHERE ID_SERVICE_APPOINTMENT = ?`, idServiceAppointment,
	)
	if err != nil {
		rep.log.ErrorContext(ctx, "DeleteByAppointmentID failed", slog.Int("idServiceAppointment", idServiceAppointment), slog.Any("error", err))
	}
	return err
}

