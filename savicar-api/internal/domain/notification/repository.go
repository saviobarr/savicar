package notification

import "context"

type Repository interface {
	Create(ctx context.Context, n *Notification) error
	FindByUser(ctx context.Context, idUser int, limit int) ([]Notification, error)
	CountUnread(ctx context.Context, idUser int) (int, error)
	MarkRead(ctx context.Context, id int, idUser int) error
	MarkAllRead(ctx context.Context, idUser int) error
}
