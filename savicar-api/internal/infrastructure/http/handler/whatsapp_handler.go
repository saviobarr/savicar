package handler

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-pdf/fpdf"
	"golang.org/x/text/encoding/charmap"

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
	db           *sql.DB
	evolutionURL string
	evolutionKey string
	log          *slog.Logger
}

func NewWhatsAppHandler(tenantSvc *apptenant.Service, db *sql.DB) *WhatsAppHandler {
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
	IDOrder        int
	CustomerName   string
	ModelName      string
	PlateNumber    string
	DateTimeIn     string
	CustomerNotes  string
	DiagnosisNotes string
	InternalNotes  string
	Discount       float64
	IDCustomer     int
}

type osProduct struct {
	Name     string
	Quantity float64
	Price    float64
}

type osService struct {
	Description string
	Total       float64
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

	// ── 1. Fetch order ────────────────────────────────────────
	var os osData
	var modelName, plateNumber, customerNotes, diagnosisNotes, internalNotes, dateTimeIn sql.NullString
	var discount sql.NullFloat64
	var idCustomer sql.NullInt64

	err := h.db.QueryRowContext(ctx, `
		SELECT so.ID_ORDER,
		       COALESCE(NULLIF(cu.INDIVIDUAL_NAME,''), NULLIF(cu.TRADE_NAME,''), NULLIF(cu.LEGAL_NAME,''), ''),
		       COALESCE(m.NAME, ''),
		       COALESCE(cm.PLATE, ''),
		       so.DATE_TIME_IN,
		       so.CUSTOMER_NOTES,
		       so.DIAGNOSIS_NOTES,
		       so.INTERNAL_NOTES,
		       so.DISCOUNT,
		       so.ID_CUSTOMER
		FROM SERVICE_ORDER so
		LEFT JOIN CUSTOMER cu  ON cu.ID_CUSTOMER         = so.ID_CUSTOMER
		LEFT JOIN CUSTOMER_MODEL cm ON cm.ID_CUSTOMER_MODEL = so.ID_CUSTOMER_MODEL
		LEFT JOIN MODEL m       ON m.ID_MODEL              = cm.ID_MODEL
		WHERE so.ID_ORDER = ?`, body.OrderID).
		Scan(&os.IDOrder, &os.CustomerName, &modelName, &plateNumber,
			&dateTimeIn, &customerNotes, &diagnosisNotes, &internalNotes,
			&discount, &idCustomer)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	os.ModelName = modelName.String
	os.PlateNumber = plateNumber.String
	os.DateTimeIn = dateTimeIn.String
	os.CustomerNotes = customerNotes.String
	os.DiagnosisNotes = diagnosisNotes.String
	os.InternalNotes = internalNotes.String
	os.Discount = discount.Float64
	if idCustomer.Valid {
		os.IDCustomer = int(idCustomer.Int64)
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

	// ── 3. Fetch services ─────────────────────────────────────
	var services []osService
	srows, err := h.db.QueryContext(ctx, `
		SELECT COALESCE(DESCRICAO, ''), COALESCE(TOTAL_VALUE, 0)
		FROM SERVICES WHERE ID_ORDER = ?`, body.OrderID)
	if err != nil {
		h.log.Error("fetch services failed", slog.Int("order_id", body.OrderID), slog.Any("error", err))
	} else {
		for srows.Next() {
			var s osService
			if err := srows.Scan(&s.Description, &s.Total); err != nil {
				h.log.Error("scan service failed", slog.Any("error", err))
			}
			services = append(services, s)
		}
		srows.Close()
	}

	// ── 4. Fetch customer WhatsApp phone ──────────────────────
	var phone string
	if os.IDCustomer > 0 {
		// prefer a contact marked as WhatsApp
		h.db.QueryRowContext(ctx, `
			SELECT COALESCE(MOBILE_PHONE, '')
			FROM CONTACT
			WHERE ID_CUSTOMER = ? AND IS_MOBILE_PHONE_WHATSAPP = 1
			LIMIT 1`, os.IDCustomer).Scan(&phone)
		// fallback to any mobile phone
		if phone == "" {
			h.db.QueryRowContext(ctx, `
				SELECT COALESCE(MOBILE_PHONE, '')
				FROM CONTACT
				WHERE ID_CUSTOMER = ?
				LIMIT 1`, os.IDCustomer).Scan(&phone)
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

	// ── 5. Generate PDF ───────────────────────────────────────
	pdfBytes, err := buildOSPDF(os, products, services)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate PDF: " + err.Error()})
		return
	}

	// ── 6. Send via Evolution API ─────────────────────────────
	instanceName, err := h.getInstanceName(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	sendPayload := map[string]any{
		"number":    phone,
		"mediatype": "document",
		"mimetype":  "application/pdf",
		"caption":   fmt.Sprintf("Ordem de Serviço #%d — %s", os.IDOrder, os.CustomerName),
		"media":     base64.StdEncoding.EncodeToString(pdfBytes),
		"fileName":  fmt.Sprintf("OS_%d.pdf", os.IDOrder),
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

// buildOSPDF generates the service order PDF in memory.
func buildOSPDF(os osData, products []osProduct, services []osService) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	pageW, _ := pdf.GetPageSize()
	contentW := pageW - 30 // left+right margins

	// ── Header ────────────────────────────────────────────────
	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(30, 30, 30)
	pdf.CellFormat(contentW, 10, fmt.Sprintf("Ordem de Servico #%d", os.IDOrder), "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "", 11)
	pdf.SetTextColor(80, 80, 80)
	pdf.CellFormat(contentW, 7, "Cliente: "+latin(os.CustomerName), "", 1, "L", false, 0, "")

	vehicle := strings.TrimSpace(os.ModelName + " " + os.PlateNumber)
	pdf.CellFormat(contentW, 7, "Veiculo: "+latin(vehicle), "", 1, "L", false, 0, "")
	pdf.CellFormat(contentW, 7, "Data de Entrada: "+latin(fmtDateBR(os.DateTimeIn)), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	// ── Section helper ─────────────────────────────────────────
	sectionHeader := func(title string) {
		pdf.SetFont("Helvetica", "B", 12)
		pdf.SetTextColor(255, 255, 255)
		pdf.SetFillColor(50, 50, 50)
		pdf.CellFormat(contentW, 8, title, "", 1, "L", true, 0, "")
		pdf.SetTextColor(30, 30, 30)
		pdf.SetFont("Helvetica", "", 10)
	}

	bodyText := func(label, value string) {
		pdf.SetFont("Helvetica", "B", 10)
		pdf.SetTextColor(60, 60, 60)
		pdf.CellFormat(45, 6, label, "", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 10)
		pdf.SetTextColor(30, 30, 30)
		pdf.MultiCell(contentW-45, 6, value, "", "L", false)
	}

	// ── Reclamação & Diagnóstico ───────────────────────────────
	sectionHeader("Observacoes do Cliente")
	pdf.SetFont("Helvetica", "", 10)
	pdf.MultiCell(contentW, 6, latin(os.CustomerNotes), "", "L", false)
	pdf.Ln(2)

	sectionHeader("Diagnostico")
	pdf.MultiCell(contentW, 6, latin(os.DiagnosisNotes), "", "L", false)
	pdf.Ln(2)

	// ── Products ───────────────────────────────────────────────
	if len(products) > 0 {
		sectionHeader("Pecas Utilizadas")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(230, 230, 230)
		pdf.SetTextColor(30, 30, 30)
		pdf.CellFormat(contentW*0.5, 6, "Descricao", "B", 0, "L", true, 0, "")
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

	// ── Services ───────────────────────────────────────────────
	if len(services) > 0 {
		sectionHeader("Servicos Realizados")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(230, 230, 230)
		pdf.CellFormat(contentW*0.75, 6, "Descricao", "B", 0, "L", true, 0, "")
		pdf.CellFormat(contentW*0.25, 6, "Total", "B", 1, "R", true, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		for i, s := range services {
			fill := i%2 == 0
			if fill {
				pdf.SetFillColor(245, 245, 245)
			} else {
				pdf.SetFillColor(255, 255, 255)
			}
			pdf.CellFormat(contentW*0.75, 6, latin(s.Description), "", 0, "L", fill, 0, "")
			pdf.CellFormat(contentW*0.25, 6, fmtBRL(s.Total), "", 1, "R", fill, 0, "")
		}
		pdf.Ln(2)
	}

	// ── Totals ─────────────────────────────────────────────────
	sectionHeader("Valores")

	totalPecas := 0.0
	for _, p := range products {
		totalPecas += p.Quantity * p.Price
	}
	totalServicos := 0.0
	for _, s := range services {
		totalServicos += s.Total
	}
	total := totalPecas + totalServicos
	totalFinal := total - os.Discount

	_ = bodyText // use helper below

	valueRow := func(label string, value float64, bold bool) {
		if bold {
			pdf.SetFont("Helvetica", "B", 10)
		} else {
			pdf.SetFont("Helvetica", "", 10)
		}
		pdf.CellFormat(contentW-50, 6, label, "", 0, "L", false, 0, "")
		pdf.CellFormat(50, 6, fmtBRL(value), "", 1, "R", false, 0, "")
	}

	valueRow("Pecas:", totalPecas, false)
	valueRow("Mao de Obra:", totalServicos, false)
	valueRow("Total:", total, false)
	if os.Discount > 0 {
		valueRow("Desconto:", os.Discount, false)
	}
	valueRow("Total Final:", totalFinal, true)
	pdf.Ln(3)

	// ── Observations ───────────────────────────────────────────
	if os.InternalNotes != "" {
		sectionHeader("Observacoes")
		pdf.SetFont("Helvetica", "", 10)
		pdf.MultiCell(contentW, 6, latin(os.InternalNotes), "", "L", false)
	}

	// ── Footer ─────────────────────────────────────────────────
	pdf.Ln(6)
	pdf.SetFont("Helvetica", "I", 8)
	pdf.SetTextColor(150, 150, 150)
	pdf.CellFormat(contentW, 6, "Obrigado pela preferencia!", "", 1, "C", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
