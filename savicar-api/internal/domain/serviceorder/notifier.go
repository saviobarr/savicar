package serviceorder

import "context"

// Notifier abstracts sending a notification about a change to an order,
// so the application layer stays decoupled from the notification module.
type Notifier interface {
	NotifyAdmins(ctx context.Context, idTenant, idOrder int, message string) error
}
