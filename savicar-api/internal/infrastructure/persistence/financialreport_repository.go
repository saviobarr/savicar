package persistence

import (
	"context"
	"database/sql"
	"log/slog"

	"savicar-api/internal/domain/financialreport"
)

type FinancialReportRepository struct {
	db  *sql.DB
	log *slog.Logger
}

func NewFinancialReportRepository(db *sql.DB) *FinancialReportRepository {
	return &FinancialReportRepository{
		db:  db,
		log: slog.Default().WithGroup("repository.financialreport"),
	}
}

func (r *FinancialReportRepository) FindByPeriod(ctx context.Context, dateFrom, dateTo string) (*financialreport.DailyReport, error) {
	query := `
		SELECT
			so.ID_ORDER,
			COALESCE(NULLIF(c.INDIVIDUAL_NAME,''), NULLIF(c.TRADE_NAME,''), NULLIF(c.LEGAL_NAME,''), '') AS customer_name,
			COALESCE((
				SELECT SUM(s.TOTAL_VALUE)
				FROM SERVICES s
				WHERE s.ID_ORDER = so.ID_ORDER
			), 0) AS service_income,
			COALESCE((
				SELECT SUM(sop.QUANTITY * inv.SALES_PRICE)
				FROM SERVICE_ORDER_PRODUCTS sop
				JOIN INVENTORY inv ON inv.ID_PRODUCT = sop.ID_PRODUCT
				WHERE sop.ID_ORDER = so.ID_ORDER
			), 0) AS product_income,
			COALESCE((
				SELECT SUM(sop.QUANTITY * inv.COST_PRICE)
				FROM SERVICE_ORDER_PRODUCTS sop
				JOIN INVENTORY inv ON inv.ID_PRODUCT = sop.ID_PRODUCT
				WHERE sop.ID_ORDER = so.ID_ORDER
			), 0) AS product_cost,
			COALESCE((
				SELECT SUM(s.TOTAL_VALUE * COALESCE(t.PERCENT, 0) / 100)
				FROM SERVICES s
				LEFT JOIN TECHNICIAN t ON t.ID_TECHNICIAN = s.ID_TECHNICIAN
				WHERE s.ID_ORDER = so.ID_ORDER
			), 0) AS technician_cost,
			COALESCE(so.DISCOUNT, 0) AS discount
		FROM SERVICE_ORDER so
		LEFT JOIN CUSTOMER c ON c.ID_CUSTOMER = so.ID_CUSTOMER
		WHERE DATE(so.DATE_TIME_IN) BETWEEN ? AND ?
		ORDER BY so.ID_ORDER`

	rows, err := r.db.QueryContext(ctx, query, dateFrom, dateTo)
	if err != nil {
		r.log.ErrorContext(ctx, "FindByPeriod failed", slog.String("date_from", dateFrom), slog.String("date_to", dateTo), slog.Any("error", err))
		return nil, err
	}
	defer rows.Close()

	report := &financialreport.DailyReport{
		Date:   dateFrom + " ~ " + dateTo,
		Orders: []financialreport.OrderResult{},
	}

	for rows.Next() {
		var o financialreport.OrderResult
		if err := rows.Scan(
			&o.IDOrder, &o.CustomerName,
			&o.ServiceIncome, &o.ProductIncome,
			&o.ProductCost, &o.TechnicianCost, &o.Discount,
		); err != nil {
			return nil, err
		}
		o.TechnicianBreakdown = []financialreport.TechnicianCostItem{}
		o.TotalIncome = o.ServiceIncome + o.ProductIncome
		o.TotalCost = o.ProductCost + o.TechnicianCost + o.Discount
		o.Result = o.TotalIncome - o.TotalCost

		report.TotalIncome += o.TotalIncome
		report.TotalCost += o.TotalCost
		report.Orders = append(report.Orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Fetch per-technician breakdown for each order
	bdQuery := `
		SELECT s.ID_ORDER, COALESCE(t.NAME, 'Sem tÃ©cnico') AS tech_name,
		       SUM(s.TOTAL_VALUE * COALESCE(t.PERCENT, 0) / 100) AS cost
		FROM SERVICES s
		LEFT JOIN TECHNICIAN t ON t.ID_TECHNICIAN = s.ID_TECHNICIAN
		JOIN SERVICE_ORDER so ON so.ID_ORDER = s.ID_ORDER
		WHERE DATE(so.DATE_TIME_IN) BETWEEN ? AND ?
		GROUP BY s.ID_ORDER, t.ID_TECHNICIAN, t.NAME
		ORDER BY s.ID_ORDER, tech_name`

	bdRows, err := r.db.QueryContext(ctx, bdQuery, dateFrom, dateTo)
	if err == nil {
		defer bdRows.Close()
		// Build a map for quick lookup
		bdMap := map[int][]financialreport.TechnicianCostItem{}
		for bdRows.Next() {
			var idOrder int
			var item financialreport.TechnicianCostItem
			if err := bdRows.Scan(&idOrder, &item.TechnicianName, &item.Cost); err == nil {
				bdMap[idOrder] = append(bdMap[idOrder], item)
			}
		}
		// Merge into orders
		for i, o := range report.Orders {
			if items, ok := bdMap[o.IDOrder]; ok {
				report.Orders[i].TechnicianBreakdown = items
			}
		}
	}

	report.Result = report.TotalIncome - report.TotalCost
	return report, nil
}

