package notification

import "time"

type Notification struct {
	IDNotification int       `json:"id_notification"`
	IDTenant       int       `json:"id_tenant"`
	IDUser         int       `json:"id_user"`
	IDOrder        *int      `json:"id_order"`
	Message        string    `json:"message"`
	IsRead         bool      `json:"is_read"`
	CreatedAt      time.Time `json:"created_at"`
}
