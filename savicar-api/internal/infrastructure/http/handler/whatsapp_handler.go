package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"log/slog"
	"mime"
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
	appserviceorderimage "savicar-api/internal/application/serviceorderimage"
	appstate "savicar-api/internal/application/state"
	apptenant "savicar-api/internal/application/tenantconfig"
	"savicar-api/internal/infrastructure/httpcurl"
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
	imageSvc     *appserviceorderimage.Service
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
	imageSvc *appserviceorderimage.Service,
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
		imageSvc:     imageSvc,
		db:           db,
		evolutionURL: url,
		evolutionKey: key,
		log:          slog.Default().WithGroup("evolution"),
	}
}

// evolutionDo is the single choke point every Evolution API call in this
// handler goes through — create-instance, status, sendOrder, disconnect —
// so logging a transport failure or a >=400 response at Error here (instead
// of the Info it used to be, which never triggered anything) is what makes
// a failed "enviar OS por WhatsApp" — or any other Evolution call — turn
// into a support WhatsApp alert via erroralert.Handler. The curl mirrors
// what actually went out, apikey redacted; the request body reused from the
// info log already redacts the base64 media payload on sendMedia calls.
// extra lets a caller attach business context (e.g. order_id/cliente on
// sendOrder) to whichever log line ends up firing.
func (h *WhatsAppHandler) evolutionDo(req *http.Request, extra ...any) (*http.Response, []byte, error) {
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
	h.log.Info("evolution api request", append([]any{
		slog.String("method", req.Method),
		slog.String("url", req.URL.String()),
		slog.String("payload", payload),
	}, extra...)...)
	curl := httpcurl.Command(req.Method, req.URL.String(),
		[]httpcurl.Header{{Key: "apikey", Value: "***redacted***"}}, []byte(payload))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.log.Error("evolution api error", append([]any{
			slog.String("method", req.Method),
			slog.String("url", req.URL.String()),
			slog.Any("error", err),
			slog.String("curl", curl),
		}, extra...)...)
		return nil, nil, err
	}
	raw, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		h.log.Error("evolution api rejected request", append([]any{
			slog.String("method", req.Method),
			slog.String("url", req.URL.String()),
			slog.Int("status", resp.StatusCode),
			slog.String("body", string(raw)),
			slog.String("curl", curl),
		}, extra...)...)
	} else {
		h.log.Info("evolution api response",
			slog.String("method", req.Method),
			slog.String("url", req.URL.String()),
			slog.Int("status", resp.StatusCode),
			slog.String("body", string(raw)),
		)
	}
	resp.Body = io.NopCloser(bytes.NewReader(raw))
	return resp, raw, nil
}

// whatsappNumberExists asks the Evolution API whether phone is a real,
// registered WhatsApp number (POST /chat/whatsappNumbers/{instance}) — used
// before sendMedia so a bad number surfaces as a clear "invalid_whatsapp_number"
// instead of an opaque Evolution error (or a silently-undelivered message).
func (h *WhatsAppHandler) whatsappNumberExists(c *gin.Context, instanceName, phone string) (bool, error) {
	body, _ := json.Marshal(map[string]any{"numbers": []string{phone}})
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost,
		h.resolveBaseURL(c)+"/chat/whatsappNumbers/"+instanceName, bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", h.evolutionKey)

	resp, raw, err := h.evolutionDo(req, slog.String("telefone", phone))
	if err != nil {
		return false, err
	}
	if resp.StatusCode >= 400 {
		return false, fmt.Errorf("evolution api rejected whatsappNumbers check (HTTP %d)", resp.StatusCode)
	}

	var results []struct {
		Exists bool `json:"exists"`
	}
	if err := json.Unmarshal(raw, &results); err != nil || len(results) == 0 {
		return false, fmt.Errorf("invalid response from evolution api")
	}
	return results[0].Exists, nil
}

// instanceState returns the Evolution connection state of the instance
// ("open" when WhatsApp is connected, "close"/"connecting" otherwise).
func (h *WhatsAppHandler) instanceState(c *gin.Context, name string) (string, error) {
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet,
		h.resolveBaseURL(c)+"/instance/connectionState/"+name, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("apikey", h.evolutionKey)
	resp, raw, err := h.evolutionDo(req)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("evolution api rejected connectionState check (HTTP %d)", resp.StatusCode)
	}
	var result struct {
		Instance struct {
			State string `json:"state"`
		} `json:"instance"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return "", err
	}
	return result.Instance.State, nil
}

const whatsappDisconnectedMsg = "O WhatsApp da empresa está desconectado. Reconecte em Configurar WhatsApp (leia o QR Code novamente) e tente enviar de novo."

// ensureConnected answers 409 whatsapp_disconnected and returns false when the
// instance isn't connected — sending then would only surface Evolution's
// opaque socket error (e.g. "Cannot read properties of undefined (reading
// 'waUploadToServer')", raised when the Baileys session isn't up). If the
// state itself can't be read, it lets the send attempt report the real problem.
func (h *WhatsAppHandler) ensureConnected(c *gin.Context, instanceName string, extra ...any) bool {
	state, err := h.instanceState(c, instanceName)
	if err != nil || state == "open" {
		return true
	}
	h.log.ErrorContext(c.Request.Context(), "whatsapp instance not connected",
		append([]any{slog.String("instance", instanceName), slog.String("state", state)}, extra...)...)
	c.JSON(http.StatusConflict, gin.H{"error": "whatsapp_disconnected", "message": whatsappDisconnectedMsg})
	return false
}

// isSocketNotReady recognises Evolution's response when the instance reports
// as connected but its WhatsApp socket is gone/not ready.
func isSocketNotReady(raw []byte) bool {
	return bytes.Contains(raw, []byte("waUploadToServer"))
}

func (h *WhatsAppHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/whatsapp")
	g.POST("/create-instance", h.createInstance)
	g.GET("/status", h.status)
	g.POST("/confirm", h.confirm)
	g.POST("/send-order", h.sendOrder)
	g.POST("/send-images", h.sendImages)
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
		"qrcode":       true,
		"integration":  "WHATSAPP-BAILEYS",
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
	// A 404 here means the instance is already gone on the provider side —
	// treat it the same as a successful disconnect instead of leaving send_wpp
	// stuck at 1 with no way to reconnect.
	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusNotFound {
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
	Remarks         string
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
	Status      int
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
		Remarks:        derefStr(order.Remarks),
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
		SELECT COALESCE(i.NAME, ''), COALESCE(sop.QUANTITY, 0), COALESCE(sop.SALES_PRICE, i.SALES_PRICE, 0)
		FROM SERVICE_ORDER_PRODUCTS sop
		LEFT JOIN INVENTORY i ON i.ID_PRODUCT = sop.ID_PRODUCT
		WHERE sop.ID_ORDER = ?`, body.OrderID)
	productsOK := err == nil
	if err != nil {
		h.log.Error("fetch products failed", slog.Int("order_id", body.OrderID), slog.Any("error", err))
	} else {
		for rows.Next() {
			var p osProduct
			if err := rows.Scan(&p.Name, &p.Quantity, &p.Price); err != nil {
				h.log.Error("scan product failed", slog.Any("error", err))
				productsOK = false
			}
			products = append(products, p)
		}
		if err := rows.Err(); err != nil {
			h.log.Error("iterate products failed", slog.Int("order_id", body.OrderID), slog.Any("error", err))
			productsOK = false
		}
		rows.Close()
	}

	// ── 3. Fetch services (same columns shown in the print view) ──────
	var services []osService
	srows, err := h.db.QueryContext(ctx, `
		SELECT COALESCE(s.DESCRICAO, ''), COALESCE(s.HOURS_QUANTITY, 0), COALESCE(s.UNIT_VALUE, 0), COALESCE(s.TOTAL_VALUE, 0), COALESCE(t.NAME, ''), COALESCE(s.STATUS, 0)
		FROM SERVICES s
		LEFT JOIN TECHNICIAN t ON t.ID_TECHNICIAN = s.ID_TECHNICIAN
		WHERE s.ID_ORDER = ?`, body.OrderID)
	servicesOK := err == nil
	if err != nil {
		h.log.Error("fetch services failed", slog.Int("order_id", body.OrderID), slog.Any("error", err))
	} else {
		for srows.Next() {
			var s osService
			if err := srows.Scan(&s.Description, &s.Hours, &s.UnitValue, &s.Total, &s.Technician, &s.Status); err != nil {
				h.log.Error("scan service failed", slog.Any("error", err))
				servicesOK = false
			}
			s.Technician = strings.TrimSpace(s.Technician)
			services = append(services, s)
		}
		if err := srows.Err(); err != nil {
			h.log.Error("iterate services failed", slog.Int("order_id", body.OrderID), slog.Any("error", err))
			servicesOK = false
		}
		srows.Close()
	}

	// The stored TOTAL_AMOUNT can be stale (line items edited after the last save of
	// the order header). The order screen always recomputes the totals from the
	// line items, so do the same here to keep the PDF consistent with the system.
	// Services with status 6 (not approved) are not charged.
	if productsOK && servicesOK {
		computed := 0.0
		for _, s := range services {
			if s.Status != 6 {
				computed += s.Total
			}
		}
		for _, p := range products {
			computed += p.Quantity * p.Price
		}
		data.TotalAmount = computed
		data.FinalAmount = computed - data.Discount
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
		phone = h.lookupCustomerPhone(ctx, data.IDCustomer)
	}
	if phone == "" && body.PhoneOverride != "" {
		phone = body.PhoneOverride
	}
	if phone == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "no_phone", "message": "Cliente não possui número de WhatsApp cadastrado."})
		return
	}
	phone = sanitizePhone(phone)

	instanceName, err := h.getInstanceName(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !h.ensureConnected(c, instanceName, slog.Int("order_id", body.OrderID)) {
		return
	}

	// ── 6b. Validate the number is a real WhatsApp account before doing any
	// of the (comparatively expensive) PDF work — a wrong/inactive number
	// otherwise only surfaced as an opaque Evolution error from sendMedia.
	if exists, err := h.whatsappNumberExists(c, instanceName, phone); err != nil {
		h.log.ErrorContext(ctx, "failed to validate whatsapp number", slog.Int("order_id", body.OrderID), slog.String("telefone", phone), slog.Any("error", err))
		// The check itself failing doesn't mean the number is bad — fall
		// through and let the actual send attempt surface any real problem.
	} else if !exists {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "invalid_whatsapp_number", "message": fmt.Sprintf("O número %s informado não é um WhatsApp válido. Verifique o número e tente novamente.", phone)})
		return
	}

	// ── 6c. Order photos, appended at the end of the PDF ──────────────
	var photos [][]byte
	if orderImages, err := h.imageSvc.GetByOrderID(ctx, body.OrderID); err != nil {
		h.log.ErrorContext(ctx, "fetch order images failed", slog.Int("order_id", body.OrderID), slog.Any("error", err))
	} else {
		for _, img := range orderImages {
			if img.ImagePath == nil || *img.ImagePath == "" {
				continue
			}
			raw, err := os.ReadFile(*img.ImagePath)
			if err != nil {
				h.log.ErrorContext(ctx, "failed to read order image for PDF", slog.Int("order_id", body.OrderID), slog.Int("image_id", img.IDImage), slog.Any("error", err))
				continue
			}
			jpg, err := prepareJPEGForPDF(raw)
			if err != nil {
				h.log.ErrorContext(ctx, "failed to decode order image for PDF", slog.Int("order_id", body.OrderID), slog.Int("image_id", img.IDImage), slog.Any("error", err))
				continue
			}
			photos = append(photos, jpg)
		}
	}

	// ── 7. Generate PDF ───────────────────────────────────────
	pdfBytes, err := buildOSPDF(data, products, services, payments, tenant, photos)
	if err != nil {
		h.log.ErrorContext(ctx, "failed to generate OS PDF for whatsapp send",
			slog.Int("order_id", body.OrderID), slog.Any("error", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate PDF: " + err.Error()})
		return
	}

	// ── 8. Send via Evolution API ─────────────────────────────

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

	resp, raw, err := h.evolutionDo(req,
		slog.Int("order_id", data.IDOrder),
		slog.String("cliente", data.CustomerName),
		slog.String("telefone", phone),
	)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "evolution api unreachable: " + err.Error()})
		return
	}
	if resp.StatusCode >= 400 {
		if isSocketNotReady(raw) {
			c.JSON(http.StatusConflict, gin.H{"error": "whatsapp_disconnected", "message": whatsappDisconnectedMsg})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": string(raw)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sent": true, "phone": phone})
}

// ── sendImages ────────────────────────────────────────────────────────────

// sendImages sends a selection of already-uploaded service order photos
// (or videos) to the customer's WhatsApp, one media message per file — used
// by the OS screen's "Mídia" tab after the user checks a few photos and
// hits "Enviar por WhatsApp".
func (h *WhatsAppHandler) sendImages(c *gin.Context) {
	var body struct {
		OrderID       int    `json:"order_id"`
		ImageIDs      []int  `json:"image_ids"`
		PhoneOverride string `json:"phone_override"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.OrderID == 0 || len(body.ImageIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_id and image_ids are required"})
		return
	}

	ctx := c.Request.Context()

	order, err := h.orderSvc.GetByID(ctx, body.OrderID)
	if err != nil || order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	customerName := derefStr(order.CustomerName)
	idCustomer := derefInt(order.IDCustomer)

	var phone string
	if idCustomer > 0 {
		phone = h.lookupCustomerPhone(ctx, idCustomer)
	}
	if phone == "" && body.PhoneOverride != "" {
		phone = body.PhoneOverride
	}
	if phone == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "no_phone", "message": "Cliente não possui número de WhatsApp cadastrado."})
		return
	}
	phone = sanitizePhone(phone)

	instanceName, err := h.getInstanceName(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !h.ensureConnected(c, instanceName, slog.Int("order_id", body.OrderID)) {
		return
	}

	if exists, err := h.whatsappNumberExists(c, instanceName, phone); err != nil {
		h.log.ErrorContext(ctx, "failed to validate whatsapp number", slog.Int("order_id", body.OrderID), slog.String("telefone", phone), slog.Any("error", err))
		// The check itself failing doesn't mean the number is bad — fall
		// through and let the actual send attempts surface any real problem.
	} else if !exists {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "invalid_whatsapp_number", "message": fmt.Sprintf("O número %s informado não é um WhatsApp válido. Verifique o número e tente novamente.", phone)})
		return
	}

	sentCount := 0
	var lastErr string
	for _, imgID := range body.ImageIDs {
		img, err := h.imageSvc.GetByID(ctx, imgID)
		if err != nil || img == nil || img.IDOrder == nil || *img.IDOrder != body.OrderID {
			h.log.ErrorContext(ctx, "image not found for whatsapp send",
				slog.Int("order_id", body.OrderID), slog.Int("image_id", imgID), slog.String("cliente", customerName))
			lastErr = "imagem não encontrada"
			continue
		}

		path, mediaType := img.ImagePath, "image"
		if path == nil {
			path, mediaType = img.VideoPath, "video"
		}
		if path == nil {
			continue
		}

		fileBytes, err := os.ReadFile(*path)
		if err != nil {
			h.log.ErrorContext(ctx, "failed to read media file for whatsapp send",
				slog.Int("order_id", body.OrderID), slog.Int("image_id", imgID), slog.String("cliente", customerName), slog.Any("error", err))
			lastErr = "falha ao ler arquivo"
			continue
		}

		mimeType := mime.TypeByExtension(filepath.Ext(*path))
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}

		sendPayload := map[string]any{
			"number":    phone,
			"mediatype": mediaType,
			"mimetype":  mimeType,
			"caption":   fmt.Sprintf("OS #%d — %s", body.OrderID, customerName),
			"media":     base64.StdEncoding.EncodeToString(fileBytes),
			"fileName":  filepath.Base(*path),
		}
		sendBody, _ := json.Marshal(sendPayload)

		req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
			h.resolveBaseURL(c)+"/message/sendMedia/"+instanceName, bytes.NewReader(sendBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("apikey", h.evolutionKey)

		resp, raw, err := h.evolutionDo(req,
			slog.Int("order_id", body.OrderID),
			slog.Int("image_id", imgID),
			slog.String("cliente", customerName),
			slog.String("telefone", phone),
		)
		if err != nil || resp.StatusCode >= 400 {
			lastErr = "falha ao enviar uma ou mais fotos"
			if err == nil && isSocketNotReady(raw) {
				c.JSON(http.StatusConflict, gin.H{"error": "whatsapp_disconnected", "message": whatsappDisconnectedMsg, "sent": sentCount, "total": len(body.ImageIDs)})
				return
			}
			continue
		}
		sentCount++
	}

	if sentCount == 0 {
		c.JSON(http.StatusBadGateway, gin.H{"error": lastErr, "sent": 0, "total": len(body.ImageIDs)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sent": sentCount, "total": len(body.ImageIDs), "phone": phone})
}

// lookupCustomerPhone prefers a contact explicitly marked as WhatsApp,
// falling back to any mobile phone on file for the customer.
func (h *WhatsAppHandler) lookupCustomerPhone(ctx context.Context, idCustomer int) string {
	var phone string
	h.db.QueryRowContext(ctx, `
		SELECT COALESCE(MOBILE_PHONE, '')
		FROM CONTACT
		WHERE ID_CUSTOMER = ? AND IS_MOBILE_PHONE_WHATSAPP = 1
		LIMIT 1`, idCustomer).Scan(&phone)
	if phone == "" {
		h.db.QueryRowContext(ctx, `
			SELECT COALESCE(MOBILE_PHONE, '')
			FROM CONTACT
			WHERE ID_CUSTOMER = ?
			LIMIT 1`, idCustomer).Scan(&phone)
	}
	return phone
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

// grayscaleLogoPNG decodes a logo image (whatever format it was uploaded as)
// and re-encodes it as PNG converted to grayscale, preserving the original
// alpha channel so a transparent-background logo stays transparent (needed
// for a watermark: only the logo's shape should paint over the page).
func grayscaleLogoPNG(raw []byte) ([]byte, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("empty logo")
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	b := img.Bounds()
	gray := image.NewNRGBA(b)
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			c := color.NRGBAModel.Convert(img.At(x, y)).(color.NRGBA)
			lum := uint8((299*uint32(c.R) + 587*uint32(c.G) + 114*uint32(c.B)) / 1000)
			gray.Set(x, y, color.NRGBA{R: lum, G: lum, B: lum, A: c.A})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, gray); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

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
func buildOSPDF(data osData, products []osProduct, services []osService, payments []osPayment, tenant tenantHeader, photos [][]byte) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	pageW, pageH := pdf.GetPageSize()
	contentW := pageW - 30 // left+right margins

	// ── Watermark (grayscale tenant logo, centered, low opacity) ────────
	// Drawn first so every later element (header, tables, text) paints over it.
	if wmPNG, err := grayscaleLogoPNG(tenant.LogoBytes); err == nil {
		opt := fpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}
		info := pdf.RegisterImageOptionsReader("logo-watermark", opt, bytes.NewReader(wmPNG))
		if info != nil && pdf.Ok() && info.Width() > 0 && info.Height() > 0 {
			wmW := pageW * 0.65
			wmH := wmW * info.Height() / info.Width()
			pdf.SetAlpha(0.10, "Normal")
			pdf.ImageOptions("logo-watermark", (pageW-wmW)/2, (pageH-wmH)/2, wmW, wmH, false, opt, 0, "")
			pdf.SetAlpha(1, "Normal")
		}
	}

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
	addrCity := joinNonEmpty(" - ", tenant.Address, tenant.CityLine)
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
		title = "Orçamento"
	}
	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(30, 30, 30)
	pdf.CellFormat(contentW, 9, latin(fmt.Sprintf("%s #%d", title, data.IDOrder)), "", 1, "L", false, 0, "")
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
	multiRow("Observações Gerais", data.Remarks)
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

	// ── Shared item-table row renderer ──────────────────────────
	// Wraps the first column's text instead of letting it overflow into the
	// numeric columns (CellFormat alone doesn't wrap or clip long text).
	const itemLineH = 6.0
	descW := contentW * 0.5
	col2W := contentW * 0.15
	col3W := contentW * 0.175
	col4W := contentW * 0.175
	// wrapLatin1 mimics fpdf's own word-wrap width calculation, but works on
	// text already Latin-1-encoded by latin() — unlike pdf.SplitText/SplitLines,
	// which always decode the string as UTF-8 runes and panic (or mangle)
	// on the raw high-byte characters (á, ç, é, ...) that latin() produces.
	wrapLatin1 := func(text string, maxW float64) []string {
		words := strings.Fields(text)
		if len(words) == 0 {
			return []string{""}
		}
		maxW -= 2 * pdf.GetCellMargin()
		lines := make([]string, 0, 2)
		line := words[0]
		for _, w := range words[1:] {
			candidate := line + " " + w
			if pdf.GetStringWidth(candidate) <= maxW {
				line = candidate
			} else {
				lines = append(lines, line)
				line = w
			}
		}
		lines = append(lines, line)
		return lines
	}
	tableRow := func(label, col2, col3, col4 string, fill bool) {
		if fill {
			pdf.SetFillColor(245, 245, 245)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}
		text := latin(label)
		lines := wrapLatin1(text, descW)
		rowH := float64(len(lines)) * itemLineH
		x0, y0 := pdf.GetXY()
		if fill {
			pdf.Rect(x0, y0, contentW, rowH, "F")
		}
		pdf.MultiCell(descW, itemLineH, text, "", "L", false)
		pdf.SetXY(x0+descW, y0)
		pdf.CellFormat(col2W, rowH, col2, "", 0, "CM", false, 0, "")
		pdf.CellFormat(col3W, rowH, col3, "", 0, "RM", false, 0, "")
		pdf.CellFormat(col4W, rowH, col4, "", 0, "RM", false, 0, "")
		pdf.SetXY(x0, y0+rowH)
	}

	// ── Services ───────────────────────────────────────────────
	if len(services) > 0 {
		sectionHeader("Servicos")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(230, 230, 230)
		pdf.CellFormat(descW, 6, "Descricao", "B", 0, "L", true, 0, "")
		pdf.CellFormat(col2W, 6, "Horas", "B", 0, "C", true, 0, "")
		pdf.CellFormat(col3W, 6, "Unit.", "B", 0, "R", true, 0, "")
		pdf.CellFormat(col4W, 6, "Total", "B", 1, "R", true, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		for i, s := range services {
			description := s.Description
			if s.Status == 6 {
				description += " - NÃO APROVADO, NÃO SERÁ COBRADO"
			}
			tableRow(description, fmt.Sprintf("%.2f", s.Hours), fmtBRL(s.UnitValue), fmtBRL(s.Total), i%2 == 0)
		}
		pdf.Ln(2)
	}

	// ── Products ───────────────────────────────────────────────
	if len(products) > 0 {
		sectionHeader("Produtos")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(230, 230, 230)
		pdf.SetTextColor(30, 30, 30)
		pdf.CellFormat(descW, 6, "Produto", "B", 0, "L", true, 0, "")
		pdf.CellFormat(col2W, 6, "Qtd", "B", 0, "C", true, 0, "")
		pdf.CellFormat(col3W, 6, "Unit.", "B", 0, "R", true, 0, "")
		pdf.CellFormat(col4W, 6, "Total", "B", 1, "R", true, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		for i, p := range products {
			lineTotal := p.Quantity * p.Price
			tableRow(p.Name, fmt.Sprintf("%.2f", p.Quantity), fmtBRL(p.Price), fmtBRL(lineTotal), i%2 == 0)
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

	// ── Photos (appended after everything else, two per row) ───────────
	if len(photos) > 0 {
		pdf.AddPage()
		sectionHeader("Fotos")
		pdf.Ln(3)
		const gap = 4.0
		cellW := (contentW - gap) / 2
		const cellH = 85.0
		bottom := pageH - 15
		col := 0
		rowTop := pdf.GetY()
		for i, jpg := range photos {
			if col == 0 && rowTop+cellH > bottom {
				pdf.AddPage()
				rowTop = pdf.GetY()
			}
			name := fmt.Sprintf("photo-%d", i)
			opt := fpdf.ImageOptions{ImageType: "JPEG"}
			info := pdf.RegisterImageOptionsReader(name, opt, bytes.NewReader(jpg))
			if info != nil && pdf.Ok() && info.Width() > 0 && info.Height() > 0 {
				w, h := cellW, cellW*info.Height()/info.Width()
				if h > cellH {
					h = cellH
					w = cellH * info.Width() / info.Height()
				}
				x := 15 + float64(col)*(cellW+gap) + (cellW-w)/2
				pdf.ImageOptions(name, x, rowTop+(cellH-h)/2, w, h, false, opt, 0, "")
			}
			col++
			if col == 2 {
				col = 0
				rowTop += cellH + gap
			}
		}
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// prepareJPEGForPDF decodes an uploaded photo (jpeg/png/gif) and re-encodes it
// as a JPEG no larger than maxPhotoSide px on its longest side, keeping the
// PDF small enough to send over WhatsApp.
func prepareJPEGForPDF(raw []byte) ([]byte, error) {
	const maxPhotoSide = 1200
	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	b := src.Bounds()
	sw, sh := b.Dx(), b.Dy()
	if sw == 0 || sh == 0 {
		return nil, fmt.Errorf("empty image")
	}
	dw, dh := sw, sh
	if longest := max(sw, sh); longest > maxPhotoSide {
		dw, dh = sw*maxPhotoSide/longest, sh*maxPhotoSide/longest
		if dw < 1 {
			dw = 1
		}
		if dh < 1 {
			dh = 1
		}
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < dh; y++ {
		for x := 0; x < dw; x++ {
			r, g, bl, a := src.At(b.Min.X+x*sw/dw, b.Min.Y+y*sh/dh).RGBA()
			// flatten transparency onto white (JPEG has no alpha)
			inv := 0xffff - a
			dst.SetRGBA(x, y, color.RGBA{
				R: uint8((r + inv) >> 8), G: uint8((g + inv) >> 8), B: uint8((bl + inv) >> 8), A: 255,
			})
		}
	}
	var out bytes.Buffer
	if err := jpeg.Encode(&out, dst, &jpeg.Options{Quality: 80}); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}
