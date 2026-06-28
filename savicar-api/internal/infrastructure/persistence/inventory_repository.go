package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/inventory"
)

type SQLServerInventoryRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerInventoryRepository(db *sql.DB) *SQLServerInventoryRepository {
	return &SQLServerInventoryRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.inventory"),
	}
}

func (r *SQLServerInventoryRepository) FindAll(ctx context.Context) ([]inventory.Inventory, error) {
	query := `SELECT i.ID_PRODUCT, i.NAME, i.CODE, i.PROVIDER, i.ID_MAKE, i.MAKER_CODE, i.PROVIDER_CODE,
	 i.INTERNAL_CODE, i.ID_UNIT, u.DESCRIPTION, i.GROSS_WEIGHT, i.NET_WEIGHT, i.STORAGE_LOCATION,
	 i.MIN, i.MAX, i.GTIN_EAN_CODE, i.ORIGINAL_NUMBER, i.SALES_PRICE, i.COST_PRICE, i.PRODUCT_SIZE,
	 i.PRODUCT_ORIGIN, i.CLASSIFICATION_TYPE, i.INITIAL_INVENTORY_QUANTITY, i.CURRENT_QUANTITY, i.PRODUCT_DETAILS, i.IMAGE_PATH
	 FROM INVENTORY i
	 LEFT JOIN UNIT u ON u.ID_UNIT = i.ID_UNIT`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []inventory.Inventory
	for rows.Next() {
		var inv inventory.Inventory
		if err := rows.Scan(
			&inv.IDProduct, &inv.Name, &inv.Code, &inv.Provider, &inv.IDMake, &inv.MakerCode,
			&inv.ProviderCode, &inv.InternalCode, &inv.IDUnity, &inv.UnityDescription,
			&inv.GrossWeight, &inv.NetWeight, &inv.StorageLocation, &inv.Min, &inv.Max,
			&inv.GtinEanCode, &inv.OriginalNumber, &inv.SalesPrice, &inv.CostPrice, &inv.ProductSize,
			&inv.ProductOrigin, &inv.ClassificationType, &inv.InitialInventoryQuantity,
			&inv.CurrentQuantity, &inv.ProductDetails, &inv.ImagePath,
		); err != nil {
			return nil, err
		}
		inv.Name = trimStringPtr(inv.Name)
		inv.Code = trimStringPtr(inv.Code)
		inv.Provider = trimStringPtr(inv.Provider)
		inv.MakerCode = trimStringPtr(inv.MakerCode)
		inv.ProviderCode = trimStringPtr(inv.ProviderCode)
		inv.InternalCode = trimStringPtr(inv.InternalCode)
		inv.UnityDescription = trimStringPtr(inv.UnityDescription)
		inv.StorageLocation = trimStringPtr(inv.StorageLocation)
		inv.GtinEanCode = trimStringPtr(inv.GtinEanCode)
		inv.OriginalNumber = trimStringPtr(inv.OriginalNumber)
		inv.ProductDetails = trimStringPtr(inv.ProductDetails)
		inv.ImagePath = trimStringPtr(inv.ImagePath)
		result = append(result, inv)
	}
	return result, rows.Err()
}

func (r *SQLServerInventoryRepository) FindByID(ctx context.Context, id int) (*inventory.Inventory, error) {
	query := `SELECT i.ID_PRODUCT, i.NAME, i.CODE, i.PROVIDER, i.ID_MAKE, i.MAKER_CODE, i.PROVIDER_CODE,
	 i.INTERNAL_CODE, i.ID_UNIT, u.DESCRIPTION, i.GROSS_WEIGHT, i.NET_WEIGHT, i.STORAGE_LOCATION,
	 i.MIN, i.MAX, i.GTIN_EAN_CODE, i.ORIGINAL_NUMBER, i.SALES_PRICE, i.COST_PRICE, i.PRODUCT_SIZE,
	 i.PRODUCT_ORIGIN, i.CLASSIFICATION_TYPE, i.INITIAL_INVENTORY_QUANTITY, i.CURRENT_QUANTITY, i.PRODUCT_DETAILS, i.IMAGE_PATH
	 FROM INVENTORY i
	 LEFT JOIN UNIT u ON u.ID_UNIT = i.ID_UNIT
	 WHERE i.ID_PRODUCT = ?`
	var inv inventory.Inventory
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&inv.IDProduct, &inv.Name, &inv.Code, &inv.Provider, &inv.IDMake, &inv.MakerCode,
		&inv.ProviderCode, &inv.InternalCode, &inv.IDUnity, &inv.UnityDescription,
		&inv.GrossWeight, &inv.NetWeight, &inv.StorageLocation, &inv.Min, &inv.Max,
		&inv.GtinEanCode, &inv.SalesPrice, &inv.CostPrice, &inv.ProductSize,
		&inv.ProductOrigin, &inv.ClassificationType, &inv.InitialInventoryQuantity,
		&inv.CurrentQuantity, &inv.ImagePath,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	inv.Name = trimStringPtr(inv.Name)
	inv.Code = trimStringPtr(inv.Code)
	inv.Provider = trimStringPtr(inv.Provider)
	inv.MakerCode = trimStringPtr(inv.MakerCode)
	inv.ProviderCode = trimStringPtr(inv.ProviderCode)
	inv.InternalCode = trimStringPtr(inv.InternalCode)
	inv.UnityDescription = trimStringPtr(inv.UnityDescription)
	inv.StorageLocation = trimStringPtr(inv.StorageLocation)
	inv.GtinEanCode = trimStringPtr(inv.GtinEanCode)
	inv.ImagePath = trimStringPtr(inv.ImagePath)
	return &inv, nil
}

func (r *SQLServerInventoryRepository) Create(ctx context.Context, inv *inventory.Inventory) error {
	query := `INSERT INTO INVENTORY
	 (NAME, CODE, PROVIDER, ID_MAKE, MAKER_CODE, PROVIDER_CODE, INTERNAL_CODE, ID_UNIT,
	  GROSS_WEIGHT, NET_WEIGHT, STORAGE_LOCATION, MIN, MAX, GTIN_EAN_CODE, ORIGINAL_NUMBER,
	  SALES_PRICE, COST_PRICE, PRODUCT_SIZE, PRODUCT_ORIGIN, CLASSIFICATION_TYPE,
	  INITIAL_INVENTORY_QUANTITY, CURRENT_QUANTITY, PRODUCT_DETAILS, IMAGE_PATH)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query,
		inv.Name, inv.Code, inv.Provider, inv.IDMake, inv.MakerCode, inv.ProviderCode,
		inv.InternalCode, inv.IDUnity, inv.GrossWeight, inv.NetWeight, inv.StorageLocation,
		inv.Min, inv.Max, inv.GtinEanCode, inv.OriginalNumber, inv.SalesPrice, inv.CostPrice, inv.ProductSize,
		inv.ProductOrigin, inv.ClassificationType, inv.InitialInventoryQuantity, inv.CurrentQuantity, inv.ProductDetails, inv.ImagePath,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	inv.IDProduct = int(id)
	return nil
}

func (r *SQLServerInventoryRepository) Update(ctx context.Context, inv *inventory.Inventory) error {
	query := `UPDATE INVENTORY
	 SET NAME = ?, CODE = ?, PROVIDER = ?, ID_MAKE = ?, MAKER_CODE = ?,
	     PROVIDER_CODE = ?, INTERNAL_CODE = ?, ID_UNIT = ?, GROSS_WEIGHT = ?,
	     NET_WEIGHT = ?, STORAGE_LOCATION = ?, MIN = ?, MAX = ?,
	     GTIN_EAN_CODE = ?, ORIGINAL_NUMBER = ?, SALES_PRICE = ?, COST_PRICE = ?, PRODUCT_SIZE = ?,
	     PRODUCT_ORIGIN = ?, CLASSIFICATION_TYPE = ?,
	     INITIAL_INVENTORY_QUANTITY = ?, CURRENT_QUANTITY = ?, PRODUCT_DETAILS = ?, IMAGE_PATH = ?
	 WHERE ID_PRODUCT = ?`
	_, err := r.db.ExecContext(ctx, query,
		inv.Name, inv.Code, inv.Provider, inv.IDMake, inv.MakerCode, inv.ProviderCode,
		inv.InternalCode, inv.IDUnity, inv.GrossWeight, inv.NetWeight, inv.StorageLocation,
		inv.Min, inv.Max, inv.GtinEanCode, inv.OriginalNumber, inv.SalesPrice, inv.CostPrice, inv.ProductSize,
		inv.ProductOrigin, inv.ClassificationType, inv.InitialInventoryQuantity, inv.CurrentQuantity, inv.ProductDetails, inv.ImagePath,
		inv.IDProduct,
	)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", inv.IDProduct), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerInventoryRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM INVENTORY WHERE ID_PRODUCT = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerInventoryRepository) AdjustQuantity(ctx context.Context, idProduct int, delta float64) error {
	query := "UPDATE INVENTORY SET CURRENT_QUANTITY = COALESCE(CURRENT_QUANTITY, 0) + ? WHERE ID_PRODUCT = ?"
	_, err := r.db.ExecContext(ctx, query, delta, idProduct)
	if err != nil {
		r.log.ErrorContext(ctx, "AdjustQuantity failed", slog.Any("error", err))
	}
	return err
}

