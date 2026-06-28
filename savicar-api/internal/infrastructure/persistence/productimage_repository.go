package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/productimage"
)

type SQLServerProductImageRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerProductImageRepository(db *sql.DB) *SQLServerProductImageRepository {
	return &SQLServerProductImageRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.product_images"),
	}
}

func (r *SQLServerProductImageRepository) FindByProductID(ctx context.Context, productID int) ([]productimage.ProductImage, error) {
	query := "SELECT ID_IMAGE, ID_PRODUCT, IMAGE_PATH FROM PRODUCT_IMAGES WHERE ID_PRODUCT = ?"
	rows, err := r.db.QueryContext(ctx, query, productID)
	if err != nil {
		r.log.ErrorContext(ctx, "FindByProductID failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []productimage.ProductImage
	for rows.Next() {
		var img productimage.ProductImage
		if err := rows.Scan(&img.IDImage, &img.IDProduct, &img.ImagePath); err != nil {
			return nil, err
		}
		img.ImagePath = trimStringPtr(img.ImagePath)
		result = append(result, img)
	}
	return result, rows.Err()
}

func (r *SQLServerProductImageRepository) FindByID(ctx context.Context, id int) (*productimage.ProductImage, error) {
	query := "SELECT ID_IMAGE, ID_PRODUCT, IMAGE_PATH FROM PRODUCT_IMAGES WHERE ID_IMAGE = ?"
	var img productimage.ProductImage
	err := r.db.QueryRowContext(ctx, query, id).Scan(&img.IDImage, &img.IDProduct, &img.ImagePath)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Any("error", err))
		return nil, err
	}
	img.ImagePath = trimStringPtr(img.ImagePath)
	return &img, nil
}

func (r *SQLServerProductImageRepository) Create(ctx context.Context, img *productimage.ProductImage) error {
	query := "INSERT INTO PRODUCT_IMAGES (ID_PRODUCT, IMAGE_PATH) VALUES (?, ?)"
	result, err := r.db.ExecContext(ctx, query, img.IDProduct, img.ImagePath)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	img.IDImage = int(id)
	return nil
}

func (r *SQLServerProductImageRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM PRODUCT_IMAGES WHERE ID_IMAGE = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Any("error", err))
	}
	return err
}

