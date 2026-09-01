package nfse

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"savicar-api/internal/domain/issuednf"
	"savicar-api/internal/domain/nf"
	"savicar-api/internal/domain/nfse"
	"savicar-api/internal/domain/tenantconfig"
)

const (
	pollInterval = 3 * time.Second
	maxPollTries = 20 // ~60s of polling before handing back to the caller
)

type Service struct {
	tenantRepo    tenantconfig.Repository
	issuedNfRepo  issuednf.Repository
	nfRepo        nf.Repository
	client        nfse.InvoiceClient
	previewRender nfse.PdfPreviewRenderer
	log           *slog.Logger
}

func NewService(tenantRepo tenantconfig.Repository, issuedNfRepo issuednf.Repository, nfRepo nf.Repository, client nfse.InvoiceClient, previewRender nfse.PdfPreviewRenderer) *Service {
	return &Service{
		tenantRepo:    tenantRepo,
		issuedNfRepo:  issuedNfRepo,
		nfRepo:        nfRepo,
		client:        client,
		previewRender: previewRender,
		log:           slog.Default().WithGroup("service.nfse"),
	}
}

// PreviewPdf renders a draft DANFSe PDF from the DPS payload the NFS-e
// screen is about to submit, enriched with the tenant's own contact info,
// so the user can review it before confirming the emission.
func (s *Service) PreviewPdf(ctx context.Context, payload []byte) ([]byte, error) {
	cfg, err := s.tenantRepo.Get(ctx)
	if err != nil {
		return nil, err
	}
	var pr nfse.PrestadorContato
	if cfg != nil {
		pr = nfse.PrestadorContato{
			NomeFantasia: derefOr(cfg.ExhibitionName, cfg.Name),
			Telefone:     derefOr(cfg.PhoneNumber, ""),
			Email:        derefOr(cfg.Email, ""),
			Endereco:     derefOr(cfg.Address, ""),
			ZipCode:      derefOr(cfg.ZipCode, ""),
		}
	}
	return s.previewRender.RenderPreview(payload, pr)
}

func derefOr(v *string, fallback string) string {
	if v == nil || *v == "" {
		return fallback
	}
	return *v
}

func (s *Service) apiKey(ctx context.Context) (string, error) {
	cfg, err := s.tenantRepo.Get(ctx)
	if err != nil {
		return "", err
	}
	if cfg == nil || cfg.ApiKeyNf == nil || *cfg.ApiKeyNf == "" {
		return "", errors.New("API Key NF não configurada em Dados da Empresa")
	}
	return *cfg.ApiKeyNf, nil
}

// EmitirNFSe submits the DPS to Focus NFe under a deterministic reference
// (savicar-nfse-{tenant}-{proximo numero}) and polls the status endpoint
// until a terminal result (authorized or rejected) or ~60s go by, whichever
// comes first — Focus authorizes asynchronously, so the caller may need to
// call ConsultarNFSe again later if this returns while still processing.
func (s *Service) EmitirNFSe(ctx context.Context, payload []byte) (ref string, statusCode int, body []byte, err error) {
	cfg, err := s.tenantRepo.Get(ctx)
	if err != nil {
		return "", 0, nil, err
	}
	if cfg == nil || cfg.ApiKeyNf == nil || *cfg.ApiKeyNf == "" {
		return "", 0, nil, errors.New("API Key NF não configurada em Dados da Empresa")
	}

	maxNumero, err := s.nfRepo.GetMaxNumero(ctx)
	if err != nil {
		return "", 0, nil, err
	}
	ref = fmt.Sprintf("savicar-nfse-%d-%d", cfg.IDTenant, maxNumero+1)

	statusCode, body, err = s.client.CreateServiceInvoice(ctx, *cfg.ApiKeyNf, ref, payload)
	if err != nil {
		return ref, 0, nil, err
	}
	if statusCode >= 400 {
		return ref, statusCode, body, nil
	}

	statusCode, body = s.pollUntilTerminal(ctx, *cfg.ApiKeyNf, ref)

	if isAuthorized(body) {
		s.saveNF(ctx, ref, payload, cfg)
		s.saveIssuedNF(ctx, ref, payload)
	}

	return ref, statusCode, body, nil
}

// ConsultarNFSe re-checks the status of a previously submitted DPS by its
// reference — used when EmitirNFSe gave up polling while Focus was still
// processing, so the frontend can ask again later.
func (s *Service) ConsultarNFSe(ctx context.Context, ref string) (int, []byte, error) {
	apiKey, err := s.apiKey(ctx)
	if err != nil {
		return 0, nil, err
	}
	return s.client.GetServiceInvoiceStatus(ctx, apiKey, ref)
}

func (s *Service) pollUntilTerminal(ctx context.Context, apiKey, ref string) (int, []byte) {
	var statusCode int
	var body []byte
	for range maxPollTries {
		select {
		case <-ctx.Done():
			return statusCode, body
		case <-time.After(pollInterval):
		}

		sc, b, err := s.client.GetServiceInvoiceStatus(ctx, apiKey, ref)
		if err != nil {
			s.log.ErrorContext(ctx, "failed to poll NFS-e status", slog.String("ref", ref), slog.Any("error", err))
			continue
		}
		statusCode, body = sc, b
		if !isProcessing(body) {
			return statusCode, body
		}
	}
	return statusCode, body
}

// focusStatusResponse captures the fields of Focus NFe's status response
// this service needs — status and a list of rejection errors, when present.
type focusStatusResponse struct {
	Status string `json:"status"`
	Erros  []struct {
		Codigo   string `json:"codigo"`
		Mensagem string `json:"mensagem"`
	} `json:"erros"`
}

func isProcessing(body []byte) bool {
	var resp focusStatusResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return false
	}
	return strings.Contains(strings.ToLower(resp.Status), "processando")
}

func isAuthorized(body []byte) bool {
	var resp focusStatusResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return false
	}
	if len(resp.Erros) > 0 {
		return false
	}
	status := strings.ToLower(resp.Status)
	for _, bad := range []string{"processando", "erro", "rejeit", "cancel", "negad"} {
		if strings.Contains(status, bad) {
			return false
		}
	}
	return status != ""
}

// outgoingDpsPayload mirrors the subset of the JSON we sent to Focus NFe
// that saveNF/saveIssuedNF need — it is not a Focus response.
type outgoingDpsPayload struct {
	SerieDps           string `json:"serie_dps"`
	RazaoSocialTomador string `json:"razao_social_tomador"`
	ValorServico       string `json:"valor_servico"`
}

func (s *Service) saveIssuedNF(ctx context.Context, ref string, payload []byte) {
	var out outgoingDpsPayload
	if err := json.Unmarshal(payload, &out); err != nil {
		return
	}

	now := time.Now().Format(time.RFC3339)
	record := &issuednf.IssuedNF{IDNf: ref, IssuedDate: &now}
	if out.RazaoSocialTomador != "" {
		record.Receiver = &out.RazaoSocialTomador
	}

	if err := s.issuedNfRepo.Create(ctx, record); err != nil {
		s.log.ErrorContext(ctx, "failed to save issued NF", slog.Any("error", err))
	}
}

// saveNF records the emitted service invoice in the nf table (the same
// table CrudPage "Notas Fiscais" and the numero_dps lookup use). numero is
// left unset: it is an auto-increment column, assigned by the DB.
func (s *Service) saveNF(ctx context.Context, ref string, payload []byte, cfg *tenantconfig.TenantConfig) {
	var out outgoingDpsPayload
	if err := json.Unmarshal(payload, &out); err != nil {
		s.log.ErrorContext(ctx, "failed to parse outgoing DPS payload for NF", slog.Any("error", err))
		return
	}

	natureza := "Prestacao de servicos"
	now := time.Now().Format(time.RFC3339)
	record := &nf.NF{
		Natureza:       &natureza,
		Protocolo:      &ref,
		DataEmissao:    &now,
		ValorTotalNota: &out.ValorServico,
	}
	if out.SerieDps != "" {
		record.Serie = &out.SerieDps
	}
	if cfg != nil {
		record.Cnpj = cfg.TaxID
		record.Endereco = cfg.Address
	}

	if err := s.nfRepo.Create(ctx, record); err != nil {
		s.log.ErrorContext(ctx, "failed to save NF", slog.Any("error", err))
	}
}
