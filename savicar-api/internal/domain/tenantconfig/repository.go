package tenantconfig

import "context"

type Repository interface {
	Get(ctx context.Context) (*TenantConfig, error)
	Update(ctx context.Context, c *TenantConfig) error
	SetSendWpp(ctx context.Context, value int) error
}
