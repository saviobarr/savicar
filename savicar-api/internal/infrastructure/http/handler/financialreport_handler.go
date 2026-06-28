package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	appfinancialreport "savicar-api/internal/application/financialreport"
)

type FinancialReportHandler struct {
	svc *appfinancialreport.Service
}

func NewFinancialReportHandler(svc *appfinancialreport.Service) *FinancialReportHandler {
	return &FinancialReportHandler{svc: svc}
}

func (h *FinancialReportHandler) RegisterRoutes(r gin.IRouter) {
	r.GET("/reports/financial/daily", h.daily)
}

// @Summary     Financial report for a period
// @Tags        reports
// @Produce     json
// @Param       date_from query string true  "Start date YYYY-MM-DD"
// @Param       date_to   query string false "End date YYYY-MM-DD (defaults to date_from)"
// @Success     200  {object} financialreport.DailyReport
// @Failure     400  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /reports/financial/daily [get]
func (h *FinancialReportHandler) daily(c *gin.Context) {
	dateFrom := c.Query("date_from")
	if dateFrom == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date_from query param required (YYYY-MM-DD)"})
		return
	}
	dateTo := c.Query("date_to")
	if dateTo == "" {
		dateTo = dateFrom
	}
	report, err := h.svc.GetByPeriod(c.Request.Context(), dateFrom, dateTo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, report)
}

