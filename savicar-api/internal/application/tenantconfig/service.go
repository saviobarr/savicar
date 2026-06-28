package tenantconfig

import (
	"context"

	"savicar-api/internal/domain/tenantconfig"
)

type Service struct{ repo tenantconfig.Repository }

func NewService(repo tenantconfig.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Get(ctx context.Context) (*tenantconfig.TenantConfig, error) {
	return s.repo.Get(ctx)
}

func (s *Service) Update(ctx context.Context, c *tenantconfig.TenantConfig) error {
	return s.repo.Update(ctx, c)
}

func (s *Service) SetSendWpp(ctx context.Context, value int) error {
	return s.repo.SetSendWpp(ctx, value)
}
