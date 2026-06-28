package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/contact"
)

type SQLServerContactRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerContactRepository(db *sql.DB) *SQLServerContactRepository {
	return &SQLServerContactRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.contact"),
	}
}

func (r *SQLServerContactRepository) FindAll(ctx context.Context) ([]contact.Contact, error) {
	query := `SELECT ID_CONTACT, ID_CUSTOMER, MOBILE_PHONE, IS_MOBILE_PHONE_WHATSAPP, EMAIL, ADDRESS,
	 ID_CITY, NEIGHBORHOOD, ADDRESS_NUMBER FROM CONTACT`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []contact.Contact
	for rows.Next() {
		var c contact.Contact
		if err := rows.Scan(
			&c.IDContact, &c.IDCustomer, &c.MobilePhone, &c.IsMobilePhoneWhatsapp, &c.Email, &c.Address,
			&c.IDCity, &c.Neighborhood, &c.AddressNumber,
		); err != nil {
			return nil, err
		}
		c.MobilePhone = trimStringPtr(c.MobilePhone)
		c.Email = trimStringPtr(c.Email)
		c.Address = trimStringPtr(c.Address)
		c.Neighborhood = trimStringPtr(c.Neighborhood)
		result = append(result, c)
	}
	return result, rows.Err()
}

func (r *SQLServerContactRepository) FindByID(ctx context.Context, id int) (*contact.Contact, error) {
	query := `SELECT ID_CONTACT, ID_CUSTOMER, MOBILE_PHONE, IS_MOBILE_PHONE_WHATSAPP, EMAIL, ADDRESS,
	 ID_CITY, NEIGHBORHOOD, ADDRESS_NUMBER FROM CONTACT WHERE ID_CONTACT = ?`
	var c contact.Contact
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&c.IDContact, &c.IDCustomer, &c.MobilePhone, &c.IsMobilePhoneWhatsapp, &c.Email, &c.Address,
		&c.IDCity, &c.Neighborhood, &c.AddressNumber,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	c.MobilePhone = trimStringPtr(c.MobilePhone)
	c.Email = trimStringPtr(c.Email)
	c.Address = trimStringPtr(c.Address)
	c.Neighborhood = trimStringPtr(c.Neighborhood)
	return &c, nil
}

func (r *SQLServerContactRepository) Create(ctx context.Context, c *contact.Contact) error {
	query := `INSERT INTO CONTACT
	 (ID_CUSTOMER, MOBILE_PHONE, IS_MOBILE_PHONE_WHATSAPP, EMAIL, ADDRESS, ID_CITY, NEIGHBORHOOD, ADDRESS_NUMBER)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query,
		c.IDCustomer, c.MobilePhone, c.IsMobilePhoneWhatsapp, c.Email, c.Address,
		c.IDCity, c.Neighborhood, c.AddressNumber,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	c.IDContact = int(id)
	return nil
}

func (r *SQLServerContactRepository) Update(ctx context.Context, c *contact.Contact) error {
	query := `UPDATE CONTACT
	 SET ID_CUSTOMER = ?, MOBILE_PHONE = ?, IS_MOBILE_PHONE_WHATSAPP = ?, EMAIL = ?, ADDRESS = ?,
	     ID_CITY = ?, NEIGHBORHOOD = ?, ADDRESS_NUMBER = ?
	 WHERE ID_CONTACT = ?`
	_, err := r.db.ExecContext(ctx, query,
		c.IDCustomer, c.MobilePhone, c.IsMobilePhoneWhatsapp, c.Email, c.Address,
		c.IDCity, c.Neighborhood, c.AddressNumber, c.IDContact,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", c.IDContact), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerContactRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM CONTACT WHERE ID_CONTACT = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

