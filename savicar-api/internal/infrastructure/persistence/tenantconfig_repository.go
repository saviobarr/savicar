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
	err := r.db.QueryRowContext(ctx, `SELECT ID_TENANT, NAME, SEND_WPP, LOGO_PATH, BASE_URL_WHATS, ZIP_CODE, ID_CITY, ADDRESS, TAX_ID,
		EXHIBITION_NAME, EMAIL, PHONE_NUMBER, API_KEY_NF, ISS_PERCENT, SERVICE_CODE, SERIE_INVOICE, CITY_SERVICE_CODE, FEDERAL_SERVICE_CODE,
		MUNICIPAL_ID, OPT_CODE_SIMPLES, REGIME_TRIB_SIMPLES_NAC, REGIME_ESP_TRIBUTACAO, CODIGO_TRIB_NAC_ISS, TRIBUTACAO_ISS, TP_ISS_RETENTION,
		PERCENT_FEDERAL_TAX, PERCENT_STATE_TAX, PERCENT_MUNICIPAL_TAX
		FROM TENANT_CONFIG LIMIT 1`).
		Scan(&c.IDTenant, &c.Name, &c.SendWpp, &c.LogoPath, &c.BaseURLWhats, &c.ZipCode, &c.IDCity, &c.Address, &c.TaxID,
			&c.ExhibitionName, &c.Email, &c.PhoneNumber, &c.ApiKeyNf, &c.IssPercent, &c.ServiceCode, &c.SerieInvoice, &c.CityServiceCode, &c.FederalServiceCode,
			&c.MunicipalID, &c.OptCodeSimples, &c.RegimeTribSimplesNac, &c.RegimeEspTributacao, &c.CodigoTribNacIss, &c.TributacaoIss, &c.TpIssRetention,
			&c.PercentFederalTax, &c.PercentStateTax, &c.PercentMunicipalTax)
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
		ZIP_CODE = ?, ID_CITY = ?, EMAIL = ?, PHONE_NUMBER = ?,
		API_KEY_NF = ?, ISS_PERCENT = ?, SERVICE_CODE = ?, SERIE_INVOICE = ?,
		CITY_SERVICE_CODE = ?, FEDERAL_SERVICE_CODE = ?,
		MUNICIPAL_ID = ?, OPT_CODE_SIMPLES = ?, REGIME_TRIB_SIMPLES_NAC = ?, REGIME_ESP_TRIBUTACAO = ?,
		CODIGO_TRIB_NAC_ISS = ?, TRIBUTACAO_ISS = ?, TP_ISS_RETENTION = ?,
		PERCENT_FEDERAL_TAX = ?, PERCENT_STATE_TAX = ?, PERCENT_MUNICIPAL_TAX = ?
		WHERE ID_TENANT = ?`
	_, err := r.db.ExecContext(ctx, query,
		c.Name, c.ExhibitionName, c.TaxID, c.Address,
		c.ZipCode, c.IDCity, c.Email, c.PhoneNumber,
		c.ApiKeyNf, c.IssPercent, c.ServiceCode, c.SerieInvoice,
		c.CityServiceCode, c.FederalServiceCode,
		c.MunicipalID, c.OptCodeSimples, c.RegimeTribSimplesNac, c.RegimeEspTributacao,
		c.CodigoTribNacIss, c.TributacaoIss, c.TpIssRetention,
		c.PercentFederalTax, c.PercentStateTax, c.PercentMunicipalTax,
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

func (r *SQLServerTenantConfigRepository) SetLogoPath(ctx context.Context, path string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE TENANT_CONFIG SET LOGO_PATH = ?", path)
	if err != nil {
		r.log.ErrorContext(ctx, "SetLogoPath failed", slog.Any("error", err))
	}
	return err
}
