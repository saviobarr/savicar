package persistence

import (
	"context"
	"database/sql"
	"log/slog"
	"strings"

	"savicar-api/internal/domain/serviceorderimage"
)

type SQLServerServiceOrderImageRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerServiceOrderImageRepository(db *sql.DB) *SQLServerServiceOrderImageRepository {
	return &SQLServerServiceOrderImageRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.service_order_images"),
	}
}

func (r *SQLServerServiceOrderImageRepository) FindAll(ctx context.Context) ([]serviceorderimage.ServiceOrderImage, error) {
	query := "SELECT ID_IMAGE, ID_ORDER, IMAGE_PATH, VIDEO_PATH FROM SERVICE_ORDER_IMAGES"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		r.log.ErrorContext(ctx, "FindAll failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var images []serviceorderimage.ServiceOrderImage
	for rows.Next() {
		var img serviceorderimage.ServiceOrderImage
		if err := rows.Scan(&img.IDImage, &img.IDOrder, &img.ImagePath, &img.VideoPath); err != nil {
			return nil, err
		}
		img.ImagePath = trimStringPtr(img.ImagePath)
		img.VideoPath = trimStringPtr(img.VideoPath)
		images = append(images, img)
	}
	return images, rows.Err()
}

func (r *SQLServerServiceOrderImageRepository) FindByOrderID(ctx context.Context, orderID int) ([]serviceorderimage.ServiceOrderImage, error) {
	query := "SELECT ID_IMAGE, ID_ORDER, IMAGE_PATH, VIDEO_PATH FROM SERVICE_ORDER_IMAGES WHERE ID_ORDER = ?"
	rows, err := r.db.QueryContext(ctx, query, orderID)
	if err != nil {
		r.log.ErrorContext(ctx, "FindByOrderID failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var images []serviceorderimage.ServiceOrderImage
	for rows.Next() {
		var img serviceorderimage.ServiceOrderImage
		if err := rows.Scan(&img.IDImage, &img.IDOrder, &img.ImagePath, &img.VideoPath); err != nil {
			return nil, err
		}
		img.ImagePath = trimStringPtr(img.ImagePath)
		img.VideoPath = trimStringPtr(img.VideoPath)
		images = append(images, img)
	}
	return images, rows.Err()
}

func (r *SQLServerServiceOrderImageRepository) FindByID(ctx context.Context, id int) (*serviceorderimage.ServiceOrderImage, error) {
	query := "SELECT ID_IMAGE, ID_ORDER, IMAGE_PATH, VIDEO_PATH FROM SERVICE_ORDER_IMAGES WHERE ID_IMAGE = ?"
	var img serviceorderimage.ServiceOrderImage
	err := r.db.QueryRowContext(ctx, query, id).Scan(&img.IDImage, &img.IDOrder, &img.ImagePath, &img.VideoPath)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.ErrorContext(ctx, "FindByID failed", slog.Int("id", id), slog.Any("error", err))
		return nil, err
	}
	img.ImagePath = trimStringPtr(img.ImagePath)
	img.VideoPath = trimStringPtr(img.VideoPath)
	return &img, nil
}

func (r *SQLServerServiceOrderImageRepository) Create(ctx context.Context, img *serviceorderimage.ServiceOrderImage) error {
	query := "INSERT INTO SERVICE_ORDER_IMAGES (ID_ORDER, IMAGE_PATH, VIDEO_PATH) VALUES (?, ?, ?)"
	result, err := r.db.ExecContext(ctx, query, img.IDOrder, img.ImagePath, img.VideoPath)
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

func (r *SQLServerServiceOrderImageRepository) Update(ctx context.Context, img *serviceorderimage.ServiceOrderImage) error {
	query := "UPDATE SERVICE_ORDER_IMAGES SET ID_ORDER = ?, IMAGE_PATH = ?, VIDEO_PATH = ? WHERE ID_IMAGE = ?"
	_, err := r.db.ExecContext(ctx, query, img.IDOrder, img.ImagePath, img.VideoPath, img.IDImage)
	if err != nil {
		r.log.ErrorContext(ctx, "Update failed", slog.Int("id", img.IDImage), slog.Any("error", err))
	}
	return err
}

func (r *SQLServerServiceOrderImageRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM SERVICE_ORDER_IMAGES WHERE ID_IMAGE = ?", id)
	if err != nil {
		r.log.ErrorContext(ctx, "Delete failed", slog.Int("id", id), slog.Any("error", err))
	}
	return err
}

func trimStringPtr(p *string) *string {
	if p == nil {
		return nil
	}
	s := strings.TrimSpace(*p)
	return &s
}

func derefInt(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}

func derefString(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}

