package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-pdf/fpdf"
	"golang.org/x/text/encoding/charmap"

	appcity "savicar-api/internal/application/city"
	apppayment "savicar-api/internal/application/payment"
	appserviceorder "savicar-api/internal/application/serviceorder"
	appstate "savicar-api/internal/application/state"
	apptenant "savicar-api/internal/application/tenantconfig"
)

var osStatusLabels = map[int]string{
	1: "Aberta",
	2: "Em Andamento",
	3: "Aguardando Peças",
	4: "Em Teste",
	5: "Concluído",
}

type WhatsAppHandler struct {
	tenantSvc    *apptenant.Service
	orderSvc     *appserviceorder.Service
	paymentSvc   *apppayment.Service
	citySvc      *appcity.Service
	stateSvc     *appstate.Service
	db           *sql.DB
	evolutionURL string
	evolutionKey string
	log          *slog.Logger
}

func NewWhatsAppHandler(
	tenantSvc *apptenant.Service,
	orderSvc *appserviceorder.Service,
	paymentSvc *apppayment.Service,
	citySvc *appcity.Service,
	stateSvc *appstate.Service,
	db *sql.DB,
) *WhatsAppHandler {
	url := os.Getenv("EVOLUTION_API_URL")
	if url == "" {
		url = "http://10.0.0.168:8081"
	}
	key := os.Getenv("EVOLUTION_API_KEY")
	if key == "" {
		key = "ad582ee8d908c0d437ac02c346ee7c747093fd676eeab8dcd633934a4b7ba843"
	}
	return &WhatsAppHandler{
		tenantSvc:    tenantSvc,
		orderSvc:     orderSvc,
		paymentSvc:   paymentSvc,
		citySvc:      citySvc,
		stateSvc:     stateSvc,
		db:           db,
		evolutionURL: url,
		evolutionKey: key,
		log:          slog.Default().WithGroup("evolution"),
	}
}

func (h *WhatsAppHandler) evolutionDo(req *http.Request) (*http.Response, []byte, error) {
	var payload string
	if req.Body != nil {
		bodyBytes, _ := io.ReadAll(req.Body)
		req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
		if !strings.Contains(req.URL.Path, "sendMedia") {
			payload = string(bodyBytes)
		} else {
			payload = "<binary omitted>"
		}
	}
	h.log.Info("evolution api request",
		slog.String("method", req.Method),
		slog.String("url", req.URL.String()),
		slog.String("payload", payload),
	)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.log.Error("evolution api error",
			slog.String("method", req.Method),
			slog.String("url", req.URL.String()),
			slog.Any("error", err),
		)
		return nil, nil, err
	}
	raw, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	h.log.Info("evolution api response",
		slog.String("method", req.Method),
		slog.String("url", req.URL.String()),
		slog.Int("status", resp.StatusCode),
		slog.String("body", string(raw)),
	)
	resp.Body = io.NopCloser(bytes.NewReader(raw))
	return resp, raw, nil
}

func (h *WhatsAppHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/whatsapp")
	g.POST("/create-instance", h.createInstance)
	g.GET("/status", h.status)
	g.POST("/confirm", h.confirm)
	g.POST("/send-order", h.sendOrder)
	g.DELETE("/disconnect", h.disconnect)
}

func (h *WhatsAppHandler) getInstanceName(c *gin.Context) (string, error) {
	cfg, err := h.tenantSvc.Get(c.Request.Context())
	if err != nil || cfg == nil {
		return "", fmt.Errorf("tenant config not found")
	}
	return fmt.Sprintf("Savicar_%s", cfg.Name), nil
}

func (h *WhatsAppHandler) resolveBaseURL(c *gin.Context) string {
	cfg, err := h.tenantSvc.Get(c.Request.Context())
	if err == nil && cfg != nil && cfg.BaseURLWhats != nil && *cfg.BaseURLWhats != "" {
		return strings.TrimRight(*cfg.BaseURLWhats, "/")
	}
	return h.evolutionURL
}

func (h *WhatsAppHandler) createInstance(c *gin.Context) {
	cfg, err := h.tenantSvc.Get(c.Request.Context())
	if err != nil || cfg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tenant config not found"})
		return
	}

	name := fmt.Sprintf("Savicar_%s", cfg.Name)
	payload := map[string]any{
		"instanceName": name,
		"qrcode":      true,
		"integration": "WHATSAPP-BAILEYS",
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequestWithContext(c.Request.Context(), http.MethodPost,
		h.resolveBaseURL(c)+"/instance/create", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", h.evolutionKey)

	resp, raw, err := h.evolutionDo(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "evolution api unreachable: " + err.Error()})
		return
	}
	if resp.StatusCode >= 400 {
		c.JSON(http.StatusBadGateway, gin.H{"error": string(raw)})
		return
	}

	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid response from evolution api"})
		return
	}

	qrcode, _ := result["qrcode"].(map[string]any)
	code, _ := qrcode["code"].(string)
	c.JSON(http.StatusOK, gin.H{"instance_name": name, "qrcode_code": code})
}

func (h *WhatsAppHandler) status(c *gin.Context) {
	name, err := h.getInstanceName(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	req, _ := http.NewRequestWithContext(c.Request.Context(), http.MethodGet,
		h.resolveBaseURL(c)+"/instance/connectionState/"+name, nil)
	req.Header.Set("apikey", h.evolutionKey)

	resp, raw, err := h.evolutionDo(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "evolution api unreachable"})
		return
	}
	_ = resp

	var result map[string]any
	json.Unmarshal(raw, &result)

	state := ""
	if instance, ok := result["instance"].(map[string]any); ok {
		state, _ = instance["state"].(string)
	}
	c.JSON(http.StatusOK, gin.H{"state": state})
}

func (h *WhatsAppHandler) confirm(c *gin.Context) {
	if err := h.tenantSvc.SetSendWpp(c.Request.Context(), 1); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"send_wpp": true})
}

func (h *WhatsAppHandler) disconnect(c *gin.Context) {
	name, err := h.getInstanceName(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	req, _ := http.NewRequestWithContext(c.Request.Context(), http.MethodDelete,
		h.resolveBaseURL(c)+"/instance/delete/"+name, nil)
	req.Header.Set("apikey", h.evolutionKey)

	resp, raw, err := h.evolutionDo(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "evolution api unreachable: " + err.Error()})
		return
	}
	if resp.StatusCode >= 400 {
		c.JSON(http.StatusBadGateway, gin.H{"error": string(raw)})
		return
	}

	// mark as disconnected in DB
	if err := h.tenantSvc.SetSendWpp(c.Request.Context(), 0); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"disconnected": true})
}

// ── sendOrder ─────────────────────────────────────────────────────────────────

type osData struct {
	IDOrder         int
	Status          int
	CustomerName    string
	CustomerPhone   string
	ModelName       string
	PlateNumber     string
	ServiceType     string
	TechnicianName  string
	DateTimeIn      string
	DateTimeOut     string
	OdometerReading string
	CustomerNotes   string
	DiagnosisNotes  string
	InternalNotes   string
	TotalAmount     float64
	Discount        float64
	FinalAmount     float64
	IDCustomer      int
}

type osProduct struct {
	Name     string
	Quantity float64
	Price    float64
}

type osService struct {
	Description string
	Hours       float64
	UnitValue   float64
	Total       float64
	Technician  string
}

type osPayment struct {
	Method      string
	DueDate     string
	PaymentDate string
	Value       float64
}

type tenantHeader struct {
	ExhibitionName string
	Address        string
	CityLine       string
	Phone          string
	Email          string
	TaxID          string
	LogoBytes      []byte
	LogoExt        string
}

func (h *WhatsAppHandler) sendOrder(c *gin.Context) {
	var body struct {
		OrderID       int    `json:"order_id"`
		PhoneOverride string `json:"phone_override"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.OrderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_id is required"})
		return
	}

	ctx := c.Request.Context()

	// ── 1. Fetch order (same source used by the frontend print view) ──
	order, err := h.orderSvc.GetByID(ctx, body.OrderID)
	if err != nil || order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}

	data := osData{
		IDOrder:        order.IDOrder,
		Status:         derefInt(order.Status),
		CustomerName:   derefStr(order.CustomerName),
		CustomerPhone:  derefStr(order.CustomerPhone),
		ModelName:      derefStr(order.ModelName),
		PlateNumber:    derefStr(order.PlateNumber),
		TechnicianName: derefStr(order.TechnicianName),
		DateTimeIn:     derefStr(order.DateTimeIn),
		DateTimeOut:    derefStr(order.DateTimeOut),
		CustomerNotes:  derefStr(order.CustomerNotes),
		DiagnosisNotes: derefStr(order.DiagnosisNotes),
		InternalNotes:  derefStr(order.InternalNotes),
		TotalAmount:    derefFloat(order.TotalAmount),
		Discount:       derefFloat(order.Discount),
		IDCustomer:     derefInt(order.IDCustomer),
	}
	if order.ServiceType != nil {
		data.ServiceType = fmt.Sprintf("%d", *order.ServiceType)
	}
	if order.OdometerReading != nil {
		data.OdometerReading = fmt.Sprintf("%d", *order.OdometerReading)
	}
	if order.FinalAmount != nil {
		data.FinalAmount = *order.FinalAmount
	} else {
		data.FinalAmount = data.TotalAmount - data.Discount
	}

	// ── 2. Fetch products ─────────────────────────────────────
	var products []osProduct
	rows, err := h.db.QueryContext(ctx, `
		SELECT COALESCE(i.NAME, ''), COALESCE(sop.QUANTITY, 0), COALESCE(i.SALES_PRICE, 0)
		FROM SERVICE_ORDER_PRODUCTS sop
		LEFT JOIN INVENTORY i ON i.ID_PRODUCT = sop.ID_PRODUCT
		WHERE sop.ID_ORDER = ?`, body.OrderID)
	if err != nil {
		h.log.Error("fetch products failed", slog.Int("order_id", body.OrderID), slog.Any("error", err))
	} else {
		for rows.Next() {
			var p osProduct
			if err := rows.Scan(&p.Name, &p.Quantity, &p.Price); err != nil {
				h.log.Error("scan product failed", slog.Any("error", err))
			}
			products = append(products, p)
		}
		rows.Close()
	}

	// ── 3. Fetch services (same columns shown in the print view) ──────
	var services []osService
	srows, err := h.db.QueryContext(ctx, `
		SELECT COALESCE(s.DESCRICAO, ''), COALESCE(s.HOURS_QUANTITY, 0), COALESCE(s.UNIT_VALUE, 0), COALESCE(s.TOTAL_VALUE, 0), COALESCE(t.NAME, '')
		FROM SERVICES s
		LEFT JOIN TECHNICIAN t ON t.ID_TECHNICIAN = s.ID_TECHNICIAN
		WHERE s.ID_ORDER = ?`, body.OrderID)
	if err != nil {
		h.log.Error("fetch services failed", slog.Int("order_id", body.OrderID), slog.Any("error", err))
	} else {
		for srows.Next() {
			var s osService
			if err := srows.Scan(&s.Description, &s.Hours, &s.UnitValue, &s.Total, &s.Technician); err != nil {
				h.log.Error("scan service failed", slog.Any("error", err))
			}
			s.Technician = strings.TrimSpace(s.Technician)
			services = append(services, s)
		}
		srows.Close()
	}

	// ── 4. Fetch payments ──────────────────────────────────────
	var payments []osPayment
	if orderPayments, err := h.paymentSvc.GetByOrderID(ctx, body.OrderID); err != nil {
		h.log.Error("fetch payments failed", slog.Int("order_id", body.OrderID), slog.Any("error", err))
	} else {
		for _, p := range orderPayments {
			payments = append(payments, osPayment{
				Method:      derefStr(p.PaymentMethodDesc),
				DueDate:     derefStr(p.DueDate),
				PaymentDate: derefStr(p.PaymentDate),
				Value:       derefFloat(p.Value),
			})
		}
	}

	// ── 5. Fetch tenant header (logo, address, contact) ────────────────
	tenant := h.buildTenantHeader(ctx)

	// ── 6. Fetch customer WhatsApp phone ──────────────────────
	var phone string
	if data.IDCustomer > 0 {
		// prefer a contact marked as WhatsApp
		h.db.QueryRowContext(ctx, `
			SELECT COALESCE(MOBILE_PHONE, '')
			FROM CONTACT
			WHERE ID_CUSTOMER = ? AND IS_MOBILE_PHONE_WHATSAPP = 1
			LIMIT 1`, data.IDCustomer).Scan(&phone)
		// fallback to any mobile phone
		if phone == "" {
			h.db.QueryRowContext(ctx, `
				SELECT COALESCE(MOBILE_PHONE, '')
				FROM CONTACT
				WHERE ID_CUSTOMER = ?
				LIMIT 1`, data.IDCustomer).Scan(&phone)
		}
	}
	if phone == "" && body.PhoneOverride != "" {
		phone = body.PhoneOverride
	}
	if phone == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "no_phone", "message": "Cliente não possui número de WhatsApp cadastrado."})
		return
	}
	phone = sanitizePhone(phone)

	// ── 7. Generate PDF ───────────────────────────────────────
	pdfBytes, err := buildOSPDF(data, products, services, payments, tenant)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate PDF: " + err.Error()})
		return
	}

	// ── 8. Send via Evolution API ─────────────────────────────
	instanceName, err := h.getInstanceName(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	sendPayload := map[string]any{
		"number":    phone,
		"mediatype": "document",
		"mimetype":  "application/pdf",
		"caption":   fmt.Sprintf("Ordem de Serviço #%d — %s", data.IDOrder, data.CustomerName),
		"media":     base64.StdEncoding.EncodeToString(pdfBytes),
		"fileName":  fmt.Sprintf("OS_%d.pdf", data.IDOrder),
	}
	sendBody, _ := json.Marshal(sendPayload)

	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		h.resolveBaseURL(c)+"/message/sendMedia/"+instanceName, bytes.NewReader(sendBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", h.evolutionKey)

	resp, raw, err := h.evolutionDo(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "evolution api unreachable: " + err.Error()})
		return
	}
	if resp.StatusCode >= 400 {
		c.JSON(http.StatusBadGateway, gin.H{"error": string(raw)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sent": true, "phone": phone})
}

// buildTenantHeader mirrors the frontend's tenant header lookup in printServiceOrder
// (fetchTenantConfig + fetchAllCity + fetchAllState) so the PDF shows the same
// logo/address/contact block as the printed document.
func (h *WhatsAppHandler) buildTenantHeader(ctx context.Context) tenantHeader {
	var tenant tenantHeader
	cfg, err := h.tenantSvc.Get(ctx)
	if err != nil || cfg == nil {
		return tenant
	}
	tenant.ExhibitionName = derefStr(cfg.ExhibitionName)
	tenant.Address = derefStr(cfg.Address)
	tenant.Phone = derefStr(cfg.PhoneNumber)
	tenant.Email = derefStr(cfg.Email)
	tenant.TaxID = derefStr(cfg.TaxID)

	if cfg.IDCity != nil {
		if city, err := h.citySvc.GetByID(ctx, *cfg.IDCity); err == nil && city != nil {
			cityName := derefStr(city.Name)
			stateAbbr := ""
			if city.IDState != nil {
				if state, err := h.stateSvc.GetByID(ctx, *city.IDState); err == nil && state != nil {
					stateAbbr = derefStr(state.Abbreviation)
				}
			}
			tenant.CityLine = joinNonEmpty(" - ", cityName, stateAbbr)
		}
	}

	if cfg.LogoPath != nil && *cfg.LogoPath != "" {
		if b, err := os.ReadFile(*cfg.LogoPath); err == nil {
			tenant.LogoBytes = b
			tenant.LogoExt = strings.TrimPrefix(strings.ToLower(filepath.Ext(*cfg.LogoPath)), ".")
		}
	}
	return tenant
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func derefInt(v *int) int {
	if v == nil {
		return 0
	}
	return *v
}

func derefFloat(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

func joinNonEmpty(sep string, parts ...string) string {
	var kept []string
	for _, p := range parts {
		if strings.TrimSpace(p) != "" {
			kept = append(kept, p)
		}
	}
	return strings.Join(kept, sep)
}

func sanitizePhone(p string) string {
	p = strings.ReplaceAll(p, " ", "")
	p = strings.ReplaceAll(p, "-", "")
	p = strings.ReplaceAll(p, "(", "")
	p = strings.ReplaceAll(p, ")", "")
	p = strings.ReplaceAll(p, "+", "")
	if !strings.HasPrefix(p, "55") {
		p = "55" + p
	}
	return p
}

func str(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

// utf8ToLatin1 converts a UTF-8 string to ISO-8859-1 for fpdf.
// Characters outside Latin-1 are replaced with '?'.
func utf8ToLatin1(s string) string {
	encoded, err := charmap.ISO8859_1.NewEncoder().String(s)
	if err != nil {
		// fallback: replace unencodable runes character by character
		var buf strings.Builder
		enc := charmap.ISO8859_1.NewEncoder()
		for _, r := range s {
			b, err := enc.String(string(r))
			if err != nil {
				buf.WriteByte('?')
			} else {
				buf.WriteString(b)
			}
		}
		return buf.String()
	}
	return encoded
}

func latin(s string) string { return utf8ToLatin1(str(s)) }

func fmtBRL(v float64) string {
	return fmt.Sprintf("R$ %.2f", v)
}

func fmtDateBR(dt string) string {
	// dt is "2024-06-15 14:30:00" or "2024-06-15T14:30:00"
	dt = strings.ReplaceAll(dt, "T", " ")
	if len(dt) >= 16 {
		parts := strings.SplitN(dt, " ", 2)
		dateParts := strings.Split(parts[0], "-")
		if len(dateParts) == 3 {
			d := dateParts[2] + "/" + dateParts[1] + "/" + dateParts[0]
			if len(parts) > 1 {
				return d + " " + parts[1][:5]
			}
			return d
		}
	}
	return dt
}

func fmtDateOnlyBR(d string) string {
	if len(d) < 10 {
		return ""
	}
	parts := strings.Split(d[:10], "-")
	if len(parts) != 3 {
		return ""
	}
	return parts[2] + "/" + parts[1] + "/" + parts[0]
}

// buildOSPDF generates the service order PDF in memory, mirroring the sections
// and totals shown in the frontend's printServiceOrder view (ServiceOrderPage.jsx):
// tenant header, order info, services, products, payments, totals and signature.
func buildOSPDF(data osData, products []osProduct, services []osService, payments []osPayment, tenant tenantHeader) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	pageW, _ := pdf.GetPageSize()
	contentW := pageW - 30 // left+right margins

	// ── Tenant header (logo + exhibition name/address/contact) ─────────
	headerTop := pdf.GetY()
	xText := 15.0
	logoH := 0.0
	if len(tenant.LogoBytes) > 0 && tenant.LogoExt != "" {
		opt := fpdf.ImageOptions{ImageType: strings.ToUpper(tenant.LogoExt), ReadDpi: true}
		info := pdf.RegisterImageOptionsReader("logo", opt, bytes.NewReader(tenant.LogoBytes))
		if info != nil && pdf.Ok() && info.Height() > 0 {
			logoH = 18.0
			logoW := logoH * info.Width() / info.Height()
			pdf.ImageOptions("logo", 15, headerTop, 0, logoH, false, opt, 0, "")
			xText = 15 + logoW + 6
		}
	}
	textW := contentW - (xText - 15)
	const lineH = 5.0
	textLines := 0
	pdf.SetXY(xText, headerTop)
	if tenant.ExhibitionName != "" {
		pdf.SetFont("Helvetica", "B", 13)
		pdf.SetTextColor(30, 30, 30)
		pdf.CellFormat(textW, lineH, latin(tenant.ExhibitionName), "", 2, "L", false, 0, "")
		textLines++
	}
	addrCity := joinNonEmpty(" — ", tenant.Address, tenant.CityLine)
	if addrCity != "" {
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(80, 80, 80)
		pdf.CellFormat(textW, lineH, latin(addrCity), "", 2, "L", false, 0, "")
		textLines++
	}
	phoneMail := joinNonEmpty("   |   ", tenant.Phone, tenant.Email)
	if phoneMail != "" {
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(80, 80, 80)
		pdf.CellFormat(textW, lineH, latin(phoneMail), "", 2, "L", false, 0, "")
		textLines++
	}
	if tenant.TaxID != "" {
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(80, 80, 80)
		pdf.CellFormat(textW, lineH, latin("CNPJ/CPF: "+tenant.TaxID), "", 2, "L", false, 0, "")
		textLines++
	}
	blockH := logoH
	if h := float64(textLines) * lineH; h > blockH {
		blockH = h
	}
	pdf.SetXY(15, headerTop+blockH+4)

	// ── Title ────────────────────────────────────────────────
	title := "Ordem de Servico"
	if data.Status == 0 {
		title = "Orcamento"
	}
	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(30, 30, 30)
	pdf.CellFormat(contentW, 9, fmt.Sprintf("%s #%d", title, data.IDOrder), "", 1, "L", false, 0, "")
	pdf.Ln(1)

	// ── Info rows (mirrors the print view's info table: labels sized
	// to their text, value right beside them, empty values stay blank) ──
	labelCell := func(label string) float64 {
		pdf.SetFont("Helvetica", "B", 10)
		pdf.SetTextColor(60, 60, 60)
		txt := utf8ToLatin1(label)
		w := pdf.GetStringWidth(txt) + 3
		pdf.CellFormat(w, 6, txt, "", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 10)
		pdf.SetTextColor(30, 30, 30)
		return w
	}
	infoRow := func(label, value string) {
		if strings.TrimSpace(value) == "" {
			return
		}
		w := labelCell(label)
		pdf.CellFormat(contentW-w, 6, utf8ToLatin1(value), "", 1, "L", false, 0, "")
	}
	infoRowPair := func(l1, v1, l2, v2 string) {
		if strings.TrimSpace(v1) == "" && strings.TrimSpace(v2) == "" {
			return
		}
		half := contentW / 2
		w1 := labelCell(l1)
		pdf.CellFormat(half-w1, 6, utf8ToLatin1(v1), "", 0, "L", false, 0, "")
		w2 := labelCell(l2)
		pdf.CellFormat(contentW-half-w2, 6, utf8ToLatin1(v2), "", 1, "L", false, 0, "")
	}
	multiRow := func(label, value string) {
		if strings.TrimSpace(value) == "" {
			return
		}
		w := labelCell(label)
		pdf.MultiCell(contentW-w, 6, utf8ToLatin1(value), "", "L", false)
	}

	infoRow("Cliente", joinNonEmpty("   |   ", data.CustomerName, data.CustomerPhone))
	infoRowPair("Modelo", data.ModelName, "Placa", data.PlateNumber)
	infoRow("Data/Hora Entrada", fmtDateBR(data.DateTimeIn))
	infoRow("Data/Hora Saida", fmtDateBR(data.DateTimeOut))
	infoRow("Hodometro (km)", data.OdometerReading)
	multiRow("Obs. do Cliente", data.CustomerNotes)
	multiRow("Diagnostico", data.DiagnosisNotes)
	pdf.Ln(3)

	// ── Section helper ─────────────────────────────────────────
	sectionHeader := func(title string) {
		pdf.SetFont("Helvetica", "B", 12)
		pdf.SetTextColor(255, 255, 255)
		pdf.SetFillColor(50, 50, 50)
		pdf.CellFormat(contentW, 8, title, "", 1, "L", true, 0, "")
		pdf.SetTextColor(30, 30, 30)
		pdf.SetFont("Helvetica", "", 10)
	}

	// ── Services ───────────────────────────────────────────────
	if len(services) > 0 {
		sectionHeader("Servicos")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(230, 230, 230)
		pdf.CellFormat(contentW*0.5, 6, "Descricao", "B", 0, "L", true, 0, "")
		pdf.CellFormat(contentW*0.15, 6, "Horas", "B", 0, "C", true, 0, "")
		pdf.CellFormat(contentW*0.175, 6, "Unit.", "B", 0, "R", true, 0, "")
		pdf.CellFormat(contentW*0.175, 6, "Total", "B", 1, "R", true, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		for i, s := range services {
			fill := i%2 == 0
			if fill {
				pdf.SetFillColor(245, 245, 245)
			} else {
				pdf.SetFillColor(255, 255, 255)
			}
			pdf.CellFormat(contentW*0.5, 6, latin(s.Description), "", 0, "L", fill, 0, "")
			pdf.CellFormat(contentW*0.15, 6, fmt.Sprintf("%.2f", s.Hours), "", 0, "C", fill, 0, "")
			pdf.CellFormat(contentW*0.175, 6, fmtBRL(s.UnitValue), "", 0, "R", fill, 0, "")
			pdf.CellFormat(contentW*0.175, 6, fmtBRL(s.Total), "", 1, "R", fill, 0, "")
		}
		pdf.Ln(2)
	}

	// ── Products ───────────────────────────────────────────────
	if len(products) > 0 {
		sectionHeader("Produtos")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(230, 230, 230)
		pdf.SetTextColor(30, 30, 30)
		pdf.CellFormat(contentW*0.5, 6, "Produto", "B", 0, "L", true, 0, "")
		pdf.CellFormat(contentW*0.15, 6, "Qtd", "B", 0, "C", true, 0, "")
		pdf.CellFormat(contentW*0.175, 6, "Unit.", "B", 0, "R", true, 0, "")
		pdf.CellFormat(contentW*0.175, 6, "Total", "B", 1, "R", true, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		for i, p := range products {
			fill := i%2 == 0
			if fill {
				pdf.SetFillColor(245, 245, 245)
			} else {
				pdf.SetFillColor(255, 255, 255)
			}
			lineTotal := p.Quantity * p.Price
			pdf.CellFormat(contentW*0.5, 6, latin(p.Name), "", 0, "L", fill, 0, "")
			pdf.CellFormat(contentW*0.15, 6, fmt.Sprintf("%.2f", p.Quantity), "", 0, "C", fill, 0, "")
			pdf.CellFormat(contentW*0.175, 6, fmtBRL(p.Price), "", 0, "R", fill, 0, "")
			pdf.CellFormat(contentW*0.175, 6, fmtBRL(lineTotal), "", 1, "R", fill, 0, "")
		}
		pdf.Ln(2)
	}

	// ── Payments ───────────────────────────────────────────────
	totalPago := 0.0
	if len(payments) > 0 {
		sectionHeader("Pagamentos")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(230, 230, 230)
		pdf.CellFormat(contentW*0.35, 6, "Forma", "B", 0, "L", true, 0, "")
		pdf.CellFormat(contentW*0.2, 6, "Vencimento", "B", 0, "C", true, 0, "")
		pdf.CellFormat(contentW*0.2, 6, "Pagamento", "B", 0, "C", true, 0, "")
		pdf.CellFormat(contentW*0.25, 6, "Valor", "B", 1, "R", true, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		for i, p := range payments {
			fill := i%2 == 0
			if fill {
				pdf.SetFillColor(245, 245, 245)
			} else {
				pdf.SetFillColor(255, 255, 255)
			}
			pdf.CellFormat(contentW*0.35, 6, latin(p.Method), "", 0, "L", fill, 0, "")
			pdf.CellFormat(contentW*0.2, 6, fmtDateOnlyBR(p.DueDate), "", 0, "C", fill, 0, "")
			pdf.CellFormat(contentW*0.2, 6, fmtDateOnlyBR(p.PaymentDate), "", 0, "C", fill, 0, "")
			pdf.CellFormat(contentW*0.25, 6, fmtBRL(p.Value), "", 1, "R", fill, 0, "")
			if p.PaymentDate != "" {
				totalPago += p.Value
			}
		}
		pdf.Ln(2)
	}

	// ── Totals ─────────────────────────────────────────────────
	sectionHeader("Valores")

	totalAberto := data.FinalAmount - totalPago

	valueRow := func(label string, value float64, bold bool) {
		if bold {
			pdf.SetFont("Helvetica", "B", 10)
		} else {
			pdf.SetFont("Helvetica", "", 10)
		}
		pdf.CellFormat(45, 6, label, "", 0, "L", false, 0, "")
		pdf.CellFormat(35, 6, fmtBRL(value), "", 1, "R", false, 0, "")
	}

	totalTerceiros := 0.0
	for _, s := range services {
		if s.Technician == "Serviço de Terceiro" || s.Technician == "Serviços de Terceiro" {
			totalTerceiros += s.Total
		}
	}

	valueRow("Total OS:", data.TotalAmount, false)
	if totalTerceiros > 0 {
		valueRow(utf8ToLatin1("Serviços de Terceiros:"), totalTerceiros, false)
	}
	if data.Discount != 0 {
		valueRow("Desconto:", data.Discount, false)
	}
	valueRow("Valor Final:", data.FinalAmount, true)
	valueRow("Total Pago:", totalPago, false)
	valueRow("Total Aberto:", totalAberto, false)
	pdf.Ln(6)

	// ── Signature ────────────────────────────────────────────────
	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(30, 30, 30)
	pdf.CellFormat(contentW, 6, latin("Blumenau _____ de ______________ de 20_______"), "", 1, "L", false, 0, "")
	pdf.Ln(10)
	pdf.CellFormat(contentW, 6, latin("Ciente e de acordo"), "", 1, "L", false, 0, "")
	pdf.Ln(2)
	pdf.CellFormat(contentW, 6, latin("Assinatura cliente/seguradora: ______________________________"), "", 1, "L", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
