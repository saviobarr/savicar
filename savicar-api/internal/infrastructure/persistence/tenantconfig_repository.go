package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/tenantconfig"
)

type SQLServerTenantConfigRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerTenantConfigRepository(db *sql.DB) *SQLServerTenantConfigRepository {
	return &SQLServerTenantConfigRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.tenantconfig"),
	}
}

func (r *SQLServerTenantConfigRepository) Get(ctx context.Context) (*tenantconfig.TenantConfig, error) {
	var c tenantconfig.TenantConfig
	err := r.db.QueryRowContext(ctx, "SELECT ID_TENANT, NAME, SEND_WPP, LOGO_PATH, BASE_URL_WHATS, ZIP_CODE, ID_CITY, ADDRESS, TAX_ID, EXHIBITION_NAME, EMAIL, PHONE_NUMBER FROM TENANT_CONFIG LIMIT 1").
		Scan(&c.IDTenant, &c.Name, &c.SendWpp, &c.LogoPath, &c.BaseURLWhats, &c.ZipCode, &c.IDCity, &c.Address, &c.TaxID, &c.ExhibitionName, &c.Email, &c.PhoneNumber)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "Get failed", slog.Any("error", err))
		return nil, err
	}
	return &c, nil
}

func (r *SQLServerTenantConfigRepository) Update(ctx context.Context, c *tenantconfig.TenantConfig) error {
	query := `UPDATE TENANT_CONFIG SET
		NAME = ?, EXHIBITION_NAME = ?, TAX_ID = ?, ADDRESS = ?,
		ZIP_CODE = ?, ID_CITY = ?, EMAIL = ?, PHONE_NUMBER = ?
		WHERE ID_TENANT = ?`
	_, err := r.db.ExecContext(ctx, query,
		c.Name, c.ExhibitionName, c.TaxID, c.Address,
		c.ZipCode, c.IDCity, c.Email, c.PhoneNumber,
		c.IDTenant,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Any("error", err))
	}
	return err
}

func (r *SQLServerTenantConfigRepository) SetSendWpp(ctx context.Context, value int) error {
	_, err := r.db.ExecContext(ctx, "UPDATE TENANT_CONFIG SET SEND_WPP = ?", value)
	if err != nil {
		r.log.ErrorContext(ctx, "SetSendWpp failed", slog.Any("error", err))
	}
	return err
}
