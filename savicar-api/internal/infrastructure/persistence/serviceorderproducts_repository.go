package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/serviceorderproducts"
)

type SQLServerServiceOrderProductsRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerServiceOrderProductsRepository(db *sql.DB) *SQLServerServiceOrderProductsRepository {
	return &SQLServerServiceOrderProductsRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.serviceorderproducts"),
	}
}

func (r *SQLServerServiceOrderProductsRepository) FindAll(ctx context.Context) ([]serviceorderproducts.ServiceOrderProduct, error) {
	query := "SELECT ID_SERVICE_ORDER_PRODUCT, ID_ORDER, ID_PRODUCT, QUANTITY FROM SERVICE_ORDER_PRODUCTS"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []serviceorderproducts.ServiceOrderProduct
	for rows.Next() {
		var sop serviceorderproducts.ServiceOrderProduct
		if err := rows.Scan(&sop.IDServiceOrderProduct, &sop.IDOrder, &sop.IDProduct, &sop.Quantity); err != nil {
			return nil, err
		}
		result = append(result, sop)
	}
	return result, rows.Err()
}

func (r *SQLServerServiceOrderProductsRepository) FindByID(ctx context.Context, id int) (*serviceorderproducts.ServiceOrderProduct, error) {
	query := "SELECT ID_SERVICE_ORDER_PRODUCT, ID_ORDER, ID_PRODUCT, QUANTITY FROM SERVICE_ORDER_PRODUCTS WHERE ID_SERVICE_ORDER_PRODUCT = ?"
	var sop serviceorderproducts.ServiceOrderProduct
	err := r.db.QueryRowContext(ctx, query, id).Scan(&sop.IDServiceOrderProduct, &sop.IDOrder, &sop.IDProduct, &sop.Quantity)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	return &sop, nil
}

func (r *SQLServerServiceOrderProductsRepository) FindByOrderID(ctx context.Context, orderID int) ([]serviceorderproducts.ServiceOrderProduct, error) {
	query := `SELECT sop.ID_SERVICE_ORDER_PRODUCT, sop.ID_ORDER, sop.ID_PRODUCT, sop.QUANTITY, inv.NAME
	 FROM SERVICE_ORDER_PRODUCTS sop
	 LEFT JOIN INVENTORY inv ON inv.ID_PRODUCT = sop.ID_PRODUCT
	 WHERE sop.ID_ORDER = ?`
	rows, err := r.db.QueryContext(ctx, query, orderID)
	if err != nil {
		r.log.ErrorContext(ctx, "FindByOrderID failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []serviceorderproducts.ServiceOrderProduct
	for rows.Next() {
		var sop serviceorderproducts.ServiceOrderProduct
		if err := rows.Scan(&sop.IDServiceOrderProduct, &sop.IDOrder, &sop.IDProduct, &sop.Quantity, &sop.ProductName); err != nil {
			return nil, err
		}
		sop.ProductName = trimStringPtr(sop.ProductName)
		result = append(result, sop)
	}
	return result, rows.Err()
}

func (r *SQLServerServiceOrderProductsRepository) Create(ctx context.Context, sop *serviceorderproducts.ServiceOrderProduct) error {
	query := "INSERT INTO SERVICE_ORDER_PRODUCTS (ID_ORDER, ID_PRODUCT, QUANTITY) VALUES (?, ?, ?)"
	result, err := r.db.ExecContext(ctx, query, sop.IDOrder, sop.IDProduct, sop.Quantity)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	sop.IDServiceOrderProduct = int(id)
	return nil
}

func (r *SQLServerServiceOrderProductsRepository) Update(ctx context.Context, sop *serviceorderproducts.ServiceOrderProduct) error {
	query := `UPDATE SERVICE_ORDER_PRODUCTS
	 SET ID_ORDER = ?, ID_PRODUCT = ?, QUANTITY = ?
	 WHERE ID_SERVICE_ORDER_PRODUCT = ?`
	_, err := r.db.ExecContext(ctx, query, sop.IDOrder, sop.IDProduct, sop.Quantity, sop.IDServiceOrderProduct)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", sop.IDServiceOrderProduct), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerServiceOrderProductsRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM SERVICE_ORDER_PRODUCTS WHERE ID_SERVICE_ORDER_PRODUCT = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

