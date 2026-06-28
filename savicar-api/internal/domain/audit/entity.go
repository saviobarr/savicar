package audit

import "time"

type Audit struct {
	IDAudit   int       `json:"id_audit"`
	IDTenant  int       `json:"id_tenant"`
	User      string    `json:"user"`
	URLCalled string    `json:"url_called"`
	Payload   *string   `json:"payload"`
	DateTime  time.Time `json:"dt_time"`
}
