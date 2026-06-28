package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/customer"
)

type SQLServerCustomerRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerCustomerRepository(db *sql.DB) *SQLServerCustomerRepository {
	return &SQLServerCustomerRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.customer"),
	}
}

func (r *SQLServerCustomerRepository) FindAll(ctx context.Context) ([]customer.Customer, error) {
	query := `SELECT ID_CUSTOMER, IS_LEGAL_PERSON, IS_ACTIVE, LEGAL_NAME, TRADE_NAME, INDIVIDUAL_NAME,
	 DOB, GENDER, TAX_ID, WEB_SITE, STATE_REGISTRATION, MUNICIPAL_REGISTRATION, IMAGE_PATH
	 FROM CUSTOMER`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []customer.Customer
	for rows.Next() {
		var c customer.Customer
		if err := rows.Scan(
			&c.IDCustomer, &c.IsLegalPerson, &c.IsActive, &c.LegalName, &c.TradeName,
			&c.IndividualName, &c.DOB, &c.Gender, &c.TaxID, &c.WebSite,
			&c.StateRegistration, &c.MunicipalRegistration, &c.ImagePath,
		); err != nil {
			return nil, err
		}
		c.LegalName = trimStringPtr(c.LegalName)
		c.TradeName = trimStringPtr(c.TradeName)
		c.IndividualName = trimStringPtr(c.IndividualName)
		c.DOB = trimStringPtr(c.DOB)
		c.TaxID = trimStringPtr(c.TaxID)
		c.WebSite = trimStringPtr(c.WebSite)
		c.StateRegistration = trimStringPtr(c.StateRegistration)
		c.MunicipalRegistration = trimStringPtr(c.MunicipalRegistration)
		c.ImagePath = trimStringPtr(c.ImagePath)
		result = append(result, c)
	}
	return result, rows.Err()
}

func (r *SQLServerCustomerRepository) FindByID(ctx context.Context, id int) (*customer.Customer, error) {
	query := `SELECT ID_CUSTOMER, IS_LEGAL_PERSON, IS_ACTIVE, LEGAL_NAME, TRADE_NAME, INDIVIDUAL_NAME,
	 DOB, GENDER, TAX_ID, WEB_SITE, STATE_REGISTRATION, MUNICIPAL_REGISTRATION, IMAGE_PATH
	 FROM CUSTOMER WHERE ID_CUSTOMER = ?`
	var c customer.Customer
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&c.IDCustomer, &c.IsLegalPerson, &c.IsActive, &c.LegalName, &c.TradeName,
		&c.IndividualName, &c.DOB, &c.Gender, &c.TaxID, &c.WebSite,
		&c.StateRegistration, &c.MunicipalRegistration, &c.ImagePath,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	c.LegalName = trimStringPtr(c.LegalName)
	c.TradeName = trimStringPtr(c.TradeName)
	c.IndividualName = trimStringPtr(c.IndividualName)
	c.DOB = trimStringPtr(c.DOB)
	c.TaxID = trimStringPtr(c.TaxID)
	c.WebSite = trimStringPtr(c.WebSite)
	c.StateRegistration = trimStringPtr(c.StateRegistration)
	c.MunicipalRegistration = trimStringPtr(c.MunicipalRegistration)
	c.ImagePath = trimStringPtr(c.ImagePath)
	return &c, nil
}

func (r *SQLServerCustomerRepository) Create(ctx context.Context, c *customer.Customer) error {
	query := `INSERT INTO CUSTOMER
	 (IS_LEGAL_PERSON, IS_ACTIVE, LEGAL_NAME, TRADE_NAME, INDIVIDUAL_NAME,
	  DOB, GENDER, TAX_ID, WEB_SITE, STATE_REGISTRATION, MUNICIPAL_REGISTRATION, IMAGE_PATH)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query,
		c.IsLegalPerson, c.IsActive, c.LegalName, c.TradeName, c.IndividualName,
		c.DOB, c.Gender, c.TaxID, c.WebSite, c.StateRegistration, c.MunicipalRegistration, c.ImagePath,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	c.IDCustomer = int(id)
	return nil
}

func (r *SQLServerCustomerRepository) Update(ctx context.Context, c *customer.Customer) error {
	query := `UPDATE CUSTOMER
	 SET IS_LEGAL_PERSON = ?, IS_ACTIVE = ?, LEGAL_NAME = ?, TRADE_NAME = ?,
	     INDIVIDUAL_NAME = ?, DOB = ?, GENDER = ?, TAX_ID = ?, WEB_SITE = ?,
	     STATE_REGISTRATION = ?, MUNICIPAL_REGISTRATION = ?, IMAGE_PATH = ?
	 WHERE ID_CUSTOMER = ?`
	_, err := r.db.ExecContext(ctx, query,
		c.IsLegalPerson, c.IsActive, c.LegalName, c.TradeName, c.IndividualName,
		c.DOB, c.Gender, c.TaxID, c.WebSite, c.StateRegistration, c.MunicipalRegistration, c.ImagePath,
		c.IDCustomer,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", c.IDCustomer), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerCustomerRepository) Delete(ctx context.Context, id int) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Collect all service order IDs linked to this customer (directly or via their vehicles)
	orderRows, err := tx.QueryContext(ctx, `
		SELECT ID_ORDER FROM SERVICE_ORDER
		WHERE ID_CUSTOMER = ?
		   OR ID_CUSTOMER_MODEL IN (SELECT ID_CUSTOMER_MODEL FROM CUSTOMER_MODEL WHERE ID_CUSTOMER = ?)`,
		id, id)
	if err != nil {
		return err
	}
	var orderIDs []int
	for orderRows.Next() {
		var oid int
		if err := orderRows.Scan(&oid); err != nil {
			orderRows.Close()
			return err
		}
		orderIDs = append(orderIDs, oid)
	}
	orderRows.Close()
	if err := orderRows.Err(); err != nil {
		return err
	}

	for _, oid := range orderIDs {
		if _, err := tx.ExecContext(ctx, "DELETE FROM PAYMENT WHERE ID_ORDER = ?", oid); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM SERVICE_ORDER_IMAGES WHERE ID_ORDER = ?", oid); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM SERVICE_ORDER_PRODUCTS WHERE ID_ORDER = ?", oid); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM SERVICES WHERE ID_ORDER = ?", oid); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM SERVICE_ORDER WHERE ID_ORDER = ?", oid); err != nil {
			return err
		}
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM CONTACT WHERE ID_CUSTOMER = ?", id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM CUSTOMER_MODEL WHERE ID_CUSTOMER = ?", id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM CUSTOMER WHERE ID_CUSTOMER = ?", id); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
		return err
	}
	return nil
}

