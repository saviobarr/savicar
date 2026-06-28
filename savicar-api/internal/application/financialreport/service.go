package financialreport

import (
	"context"

	"savicar-api/internal/domain/financialreport"
	"savicar-api/internal/infrastructure/persistence"
)

type Service struct {
	repo *persistence.FinancialReportRepository
}

func NewService(repo *persistence.FinancialReportRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetByPeriod(ctx context.Context, dateFrom, dateTo string) (*financialreport.DailyReport, error) {
	return s.repo.FindByPeriod(ctx, dateFrom, dateTo)
}

