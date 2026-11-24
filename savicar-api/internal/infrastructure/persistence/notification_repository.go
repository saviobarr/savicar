package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/notification"
)

type SQLServerNotificationRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewSQLServerNotificationRepository(db *sql.DB) *SQLServerNotificationRepository {
	return &SQLServerNotificationRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.notification"),
	}
}

func (r *SQLServerNotificationRepository) Create(ctx context.Context, n *notification.Notification) error {
	query := "INSERT INTO NOTIFICATIONS (ID_TENANT, ID_USER, ID_ORDER, MESSAGE) VALUES (?, ?, ?, ?)"
	result, err := r.db.ExecContext(ctx, query, n.IDTenant, n.IDUser, n.IDOrder, n.Message)
	if err != nil {
		r.log.ErrorContext(ctx, "Create failed", slog.Any("error", err))
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	n.IDNotification = int(id)
	return nil
}

func (r *SQLServerNotificationRepository) FindByUser(ctx context.Context, idUser int, limit int) ([]notification.Notification, error) {
	query := "SELECT ID_NOTIFICATION, ID_TENANT, ID_USER, ID_ORDER, MESSAGE, IS_READ, CREATED_AT " +
		"FROM NOTIFICATIONS WHERE ID_USER = ? ORDER BY CREATED_AT DESC LIMIT ?"
	rows, err := r.db.QueryContext(ctx, query, idUser, limit)
	if err != nil {
		r.log.ErrorContext(ctx, "FindByUser failed", slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	var result []notification.Notification
	for rows.Next() {
		var n notification.Notification
		if err := rows.Scan(&n.IDNotification, &n.IDTenant, &n.IDUser, &n.IDOrder, &n.Message, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, n)
	}
	return result, rows.Err()
}

func (r *SQLServerNotificationRepository) CountUnread(ctx context.Context, idUser int) (int, error) {
	var count int
	query := "SELECT COUNT(*) FROM NOTIFICATIONS WHERE ID_USER = ? AND IS_READ = 0"
	err := r.db.QueryRowContext(ctx, query, idUser).Scan(&count)
	if err != nil {
		r.log.ErrorContext(ctx, "CountUnread failed", slog.Any("error", err))
	}
	return count, err
}

func (r *SQLServerNotificationRepository) MarkRead(ctx context.Context, id int, idUser int) error {
	query := "UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE ID_NOTIFICATION = ? AND ID_USER = ?"
	_, err := r.db.ExecContext(ctx, query, id, idUser)
	if err != nil {
		r.log.ErrorContext(ctx, "MarkRead failed", slog.Any("error", err))
	}
	return err
}

func (r *SQLServerNotificationRepository) MarkAllRead(ctx context.Context, idUser int) error {
	query := "UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE ID_USER = ? AND IS_READ = 0"
	_, err := r.db.ExecContext(ctx, query, idUser)
	if err != nil {
		r.log.ErrorContext(ctx, "MarkAllRead failed", slog.Any("error", err))
	}
	return err
}
