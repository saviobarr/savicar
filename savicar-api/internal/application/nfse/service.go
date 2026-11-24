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
func (s *Service) EmitirNFSe(ctx context.Context, payload []byte) (ref string, statusCode int, body []byte, curl string, err error) {
	cfg, err := s.tenantRepo.Get(ctx)
	if err != nil {
		return "", 0, nil, "", err
	}
	if cfg == nil || cfg.ApiKeyNf == nil || *cfg.ApiKeyNf == "" {
		return "", 0, nil, "", errors.New("API Key NF não configurada em Dados da Empresa")
	}

	maxNumero, err := s.nfRepo.GetMaxNumero(ctx)
	if err != nil {
		return "", 0, nil, "", err
	}
	ref = fmt.Sprintf("savicar-nfse-%d-%d", cfg.IDTenant, maxNumero+1)
	cliente := clienteFromPayload(payload)

	statusCode, body, curl, err = s.client.CreateServiceInvoice(ctx, *cfg.ApiKeyNf, ref, cliente, payload)
	if err != nil {
		return ref, 0, nil, curl, err
	}
	if statusCode >= 400 {
		return ref, statusCode, body, curl, nil
	}

	statusCode, body, curl = s.pollUntilTerminal(ctx, *cfg.ApiKeyNf, ref, cliente)

	if isAuthorized(body) {
		out := parseOutgoingDpsPayload(payload)
		s.saveOrUpdateNF(ctx, ref, out.RazaoSocialTomador, out.ValorServico, out.SerieDps, body, cfg)
		s.saveIssuedNF(ctx, ref, payload)
	}

	return ref, statusCode, body, curl, nil
}

// ConsultarNFSe re-checks the status of a previously submitted DPS by its
// reference — used when EmitirNFSe gave up polling while Focus was still
// processing, so the frontend can ask again later. tomador and valorServico
// come from the NFS-e screen's still-in-memory form (the same values sent
// with the original emitir call) since this later request has no other way
// to know them — when the invoice is now authorized, they complete the nf
// record that EmitirNFSe's own polling window didn't get to save.
func (s *Service) ConsultarNFSe(ctx context.Context, ref, tomador, valorServico string) (int, []byte, string, error) {
	cfg, err := s.tenantRepo.Get(ctx)
	if err != nil {
		return 0, nil, "", err
	}
	if cfg == nil || cfg.ApiKeyNf == nil || *cfg.ApiKeyNf == "" {
		return 0, nil, "", errors.New("API Key NF não configurada em Dados da Empresa")
	}

	// cliente is unknown here — ConsultarNFSe only has the ref, not the
	// original DPS payload — so a failure log for this path won't carry it.
	statusCode, body, curl, err := s.client.GetServiceInvoiceStatus(ctx, *cfg.ApiKeyNf, ref, "")
	if err != nil {
		return statusCode, body, curl, err
	}

	if isAuthorized(body) {
		s.saveOrUpdateNF(ctx, ref, tomador, valorServico, "", body, cfg)
	}

	return statusCode, body, curl, nil
}

func (s *Service) pollUntilTerminal(ctx context.Context, apiKey, ref, cliente string) (int, []byte, string) {
	var statusCode int
	var body []byte
	var curl string
	for range maxPollTries {
		select {
		case <-ctx.Done():
			return statusCode, body, curl
		case <-time.After(pollInterval):
		}

		sc, b, cu, err := s.client.GetServiceInvoiceStatus(ctx, apiKey, ref, cliente)
		curl = cu
		if err != nil {
			s.log.ErrorContext(ctx, "failed to poll NFS-e status", slog.String("ref", ref), slog.String("cliente", cliente), slog.Any("error", err), slog.String("curl", cu))
			continue
		}
		statusCode, body = sc, b
		if !isProcessing(body) {
			return statusCode, body, curl
		}
	}
	return statusCode, body, curl
}

// clienteFromPayload pulls the tomador's razão social out of the outgoing
// DPS payload for logging purposes only — see InvoiceClient's cliente
// parameter.
func clienteFromPayload(payload []byte) string {
	return parseOutgoingDpsPayload(payload).RazaoSocialTomador
}

// parseOutgoingDpsPayload extracts the subset of the outgoing DPS JSON that
// saveOrUpdateNF/saveIssuedNF need. On malformed payload it returns a zero
// value — callers treat missing fields as "unknown", not an error.
func parseOutgoingDpsPayload(payload []byte) outgoingDpsPayload {
	var out outgoingDpsPayload
	_ = json.Unmarshal(payload, &out)
	return out
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

// focusAuthorizedResponse captures the fields of Focus NFe's authorized
// response that saveOrUpdateNF needs to store alongside the nf record.
type focusAuthorizedResponse struct {
	UrlDanfse string `json:"url_danfse"`
}

// saveOrUpdateNF records an authorized NFS-e in the nf table (the same
// table CrudPage "Notas Fiscais" and the numero_dps lookup use), keyed by
// Protocolo = ref. Both EmitirNFSe (when authorization lands within its own
// polling window) and ConsultarNFSe (when it lands later, on a follow-up
// check) call this for the same ref — so it updates the row if one already
// exists instead of creating a duplicate, filling in whichever of
// tomador/valorServico/serieDps/url_download it now has that the row is
// still missing. Tipo is always set to nf.TipoNFS so the NFS-e listing
// (which filters by tipo=1) picks the row up.
func (s *Service) saveOrUpdateNF(ctx context.Context, ref, tomador, valorServico, serieDps string, body []byte, cfg *tenantconfig.TenantConfig) {
	var urlDownload string
	var resp focusAuthorizedResponse
	if err := json.Unmarshal(body, &resp); err == nil {
		urlDownload = resp.UrlDanfse
	}

	existing, err := s.nfRepo.FindByProtocolo(ctx, ref)
	if err != nil {
		s.log.ErrorContext(ctx, "failed to look up existing NF by protocolo", slog.String("ref", ref), slog.Any("error", err))
		return
	}

	tipo := nf.TipoNFS
	if existing != nil {
		var tomadorPtr, valorServicoPtr, serieDpsPtr, urlDownloadPtr *string
		if tomador != "" {
			tomadorPtr = &tomador
		}
		if valorServico != "" {
			valorServicoPtr = &valorServico
		}
		if serieDps != "" {
			serieDpsPtr = &serieDps
		}
		if urlDownload != "" {
			urlDownloadPtr = &urlDownload
		}
		if err := s.nfRepo.UpdateNFSeFields(ctx, existing.Numero, tomadorPtr, valorServicoPtr, serieDpsPtr, urlDownloadPtr, tipo); err != nil {
			s.log.ErrorContext(ctx, "failed to update NF", slog.String("ref", ref), slog.Any("error", err))
		}
		return
	}

	natureza := "Prestacao de servicos"
	now := time.Now().Format(time.RFC3339)
	record := &nf.NF{
		Natureza:    &natureza,
		Protocolo:   &ref,
		DataEmissao: &now,
		Tipo:        &tipo,
	}
	if valorServico != "" {
		record.ValorTotalNota = &valorServico
	}
	if serieDps != "" {
		record.Serie = &serieDps
	}
	if tomador != "" {
		record.Tomador = &tomador
	}
	if urlDownload != "" {
		record.UrlDownload = &urlDownload
	}
	if cfg != nil {
		record.Cnpj = cfg.TaxID
		record.Endereco = cfg.Address
	}

	if err := s.nfRepo.Create(ctx, record); err != nil {
		s.log.ErrorContext(ctx, "failed to save NF", slog.String("ref", ref), slog.Any("error", err))
	}
}
