package nfsepdf

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/go-pdf/fpdf"

	"savicar-api/internal/domain/nfse"
)

// dpsPayload mirrors the JSON the NFS-e screen builds and sends to
// POST /nfse/emitir — see savicar-web/src/pages/NfsePage.jsx buildPayload.
type dpsPayload struct {
	DataEmissao                       string `json:"data_emissao"`
	SerieDps                          string `json:"serie_dps"`
	NumeroDps                         string `json:"numero_dps"`
	DataCompetencia                   string `json:"data_competencia"`
	EmitenteDps                       string `json:"emitente_dps"`
	CodigoMunicipioEmissora           string `json:"codigo_municipio_emissora"`
	CnpjPrestador                     string `json:"cnpj_prestador"`
	InscricaoMunicipalPrestador       string `json:"inscricao_municipal_prestador"`
	CodigoOpcaoSimplesNacional        string `json:"codigo_opcao_simples_nacional"`
	RegimeTributarioSimplesNacional   string `json:"regime_tributario_simples_nacional"`
	RegimeEspecialTributacao          string `json:"regime_especial_tributacao"`
	CnpjTomador                       string `json:"cnpj_tomador"`
	RazaoSocialTomador                string `json:"razao_social_tomador"`
	CodigoMunicipioPrestacao          string `json:"codigo_municipio_prestacao"`
	CodigoTributacaoNacionalIss       string `json:"codigo_tributacao_nacional_iss"`
	DescricaoServico                  string `json:"descricao_servico"`
	ValorServico                      string `json:"valor_servico"`
	TributacaoIss                     string `json:"tributacao_iss"`
	TipoRetencaoIss                   string `json:"tipo_retencao_iss"`
	PercentualTotalTributosFederais   string `json:"percentual_total_tributos_federais"`
	PercentualTotalTributosEstaduais  string `json:"percentual_total_tributos_estaduais"`
	PercentualTotalTributosMunicipais string `json:"percentual_total_tributos_municipais"`
}

// Renderer implements savicar-api/internal/domain/nfse.PdfPreviewRenderer.
type Renderer struct{}

func NewRenderer() *Renderer { return &Renderer{} }

func (Renderer) RenderPreview(payload []byte, prestador nfse.PrestadorContato) ([]byte, error) {
	var d dpsPayload
	if err := json.Unmarshal(payload, &d); err != nil {
		return nil, fmt.Errorf("payload da DPS inválido: %w", err)
	}
	return render(d, prestador)
}

const (
	pageMargin = 10.0
	labelSize  = 6.0
	valueSize  = 8.5
	titleSize  = 11.0
)

func box(pdf *fpdf.Fpdf, x, y, w, h float64, label, value string, align string) {
	pdf.Rect(x, y, w, h, "D")
	pdf.SetXY(x+1.2, y+0.8)
	pdf.SetFont("Helvetica", "", labelSize)
	pdf.SetTextColor(90, 90, 90)
	pdf.MultiCell(w-2.4, labelSize*0.4, latin(label), "", "L", false)
	pdf.SetXY(x+1.2, y+h-valueSize*0.5)
	pdf.SetFont("Helvetica", "B", valueSize)
	pdf.SetTextColor(20, 20, 20)
	pdf.MultiCell(w-2.4, 4, latin(value), "", align, false)
}

type col struct {
	w     float64
	label string
	value string
	align string
}

func row(pdf *fpdf.Fpdf, x, y, h float64, cols []col) float64 {
	cx := x
	for _, c := range cols {
		align := c.align
		if align == "" {
			align = "L"
		}
		box(pdf, cx, y, c.w, h, c.label, c.value, align)
		cx += c.w
	}
	return y + h
}

func sectionTitle(pdf *fpdf.Fpdf, x, y float64, title string) float64 {
	pdf.SetXY(x, y)
	pdf.SetFont("Helvetica", "B", titleSize)
	pdf.SetTextColor(20, 20, 20)
	pdf.CellFormat(0, 6, latin(title), "", 2, "L", false, 0, "")
	return y + 6
}

func render(d dpsPayload, pr nfse.PrestadorContato) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(pageMargin, pageMargin, pageMargin)
	pdf.SetAutoPageBreak(true, pageMargin)
	pdf.AddPage()

	pageW, _ := pdf.GetPageSize()
	contentW := pageW - 2*pageMargin
	x := pageMargin
	y := pageMargin

	municipioEmissora := municipioUF(d.CodigoMunicipioEmissora)

	// ── Banner ───────────────────────────────────────────────────
	pdf.SetFillColor(249, 115, 22)
	pdf.Rect(x, y, contentW, 8, "F")
	pdf.SetXY(x, y+1.2)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(contentW, 6, latin("PREVIA - DOCUMENTO NAO EMITIDO, SEM VALOR FISCAL"), "", 1, "C", false, 0, "")
	y += 11

	// ── Header ───────────────────────────────────────────────────
	headerH := 16.0
	rightW := 70.0
	leftW := contentW - rightW
	pdf.Rect(x, y, contentW, headerH, "D")
	pdf.Line(x+leftW, y, x+leftW, y+headerH)

	pdf.SetXY(x+2, y+3)
	pdf.SetFont("Helvetica", "B", 12)
	pdf.SetTextColor(20, 20, 20)
	pdf.CellFormat(leftW-4, 5, latin("DANFSe v2.0 (prévia)"), "", 2, "L", false, 0, "")
	pdf.SetX(x + 2)
	pdf.SetFont("Helvetica", "", 9)
	pdf.CellFormat(leftW-4, 5, latin("Documento Auxiliar da NFS-e"), "", 2, "L", false, 0, "")

	pdf.SetXY(x+leftW+2, y+1.5)
	pdf.SetFont("Helvetica", "", 7.5)
	pdf.SetTextColor(60, 60, 60)
	pdf.MultiCell(rightW-4, 3.3, latin("Município: "+municipioEmissora+"\nAmbiente Gerador: Sistema Nacional da NFS-e\nTipo de Ambiente: Produção"), "", "L", false)
	y += headerH

	// ── Chave de acesso / QR ────────────────────────────────────
	chaveH := 14.0
	qrW := 24.0
	pdf.Rect(x, y, contentW-qrW, chaveH, "D")
	pdf.SetXY(x+1.2, y+0.8)
	pdf.SetFont("Helvetica", "", labelSize)
	pdf.SetTextColor(90, 90, 90)
	pdf.CellFormat(contentW-qrW-2.4, 3, latin("CHAVE DE ACESSO DA NFS-E"), "", 2, "L", false, 0, "")
	pdf.SetX(x + 1.2)
	pdf.SetFont("Helvetica", "I", valueSize)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(contentW-qrW-2.4, 5, latin("(gerada somente apos a emissao)"), "", 0, "L", false, 0, "")

	pdf.Rect(x+contentW-qrW, y, qrW, chaveH, "D")
	pdf.SetXY(x+contentW-qrW+1, y+1)
	pdf.SetFont("Helvetica", "I", 5.5)
	pdf.SetTextColor(120, 120, 120)
	pdf.MultiCell(qrW-2, 2.6, latin("QR Code disponivel apos a emissao"), "", "C", false)
	y += chaveH

	// ── Número/Competência/Data NFS-e, DPS ──────────────────────
	y = row(pdf, x, y, 9, []col{
		{w: contentW / 3, label: "NUMERO DA NFS-E", value: "-"},
		{w: contentW / 3, label: "COMPETENCIA DA NFS-E", value: formatDataOnly(d.DataCompetencia)},
		{w: contentW / 3, label: "DATA E HORA DA EMISSAO DA NFS-E", value: "(apos emissao)"},
	})
	y = row(pdf, x, y, 9, []col{
		{w: contentW / 3, label: "NUMERO DA DPS", value: d.NumeroDps},
		{w: contentW / 3, label: "SERIE DA DPS", value: d.SerieDps},
		{w: contentW / 3, label: "DATA E HORA DA EMISSAO DA DPS", value: formatDataHora(d.DataEmissao)},
	})
	y = row(pdf, x, y, 8, []col{
		{w: contentW / 3, label: "EMITENTE DA NFS-E", value: "Prestador"},
		{w: contentW / 3, label: "SITUACAO DA NFS-E", value: "(pendente de emissao)"},
		{w: contentW / 3, label: "FINALIDADE", value: "NFS-e regular"},
	})
	y += 3

	// ── Prestador ────────────────────────────────────────────────
	y = sectionTitle(pdf, x, y, "PRESTADOR / FORNECEDOR")
	y = row(pdf, x, y, 9, []col{
		{w: contentW * 0.34, label: "CNPJ / CPF / NIF", value: formatCpfCnpj(d.CnpjPrestador)},
		{w: contentW * 0.33, label: "INDICADOR MUNICIPAL (INSCRICAO)", value: d.InscricaoMunicipalPrestador},
		{w: contentW * 0.33, label: "TELEFONE", value: pr.Telefone},
	})
	y = row(pdf, x, y, 9, []col{
		{w: contentW * 0.5, label: "NOME / NOME EMPRESARIAL", value: pr.NomeFantasia},
		{w: contentW * 0.25, label: "MUNICIPIO / SIGLA UF", value: municipioEmissora},
		{w: contentW * 0.25, label: "CODIGO IBGE / CEP", value: d.CodigoMunicipioEmissora + " / " + formatCep(pr.ZipCode)},
	})
	y = row(pdf, x, y, 9, []col{
		{w: contentW * 0.6, label: "ENDERECO", value: pr.Endereco},
		{w: contentW * 0.4, label: "E-MAIL", value: pr.Email},
	})
	y = row(pdf, x, y, 9, []col{
		{w: contentW * 0.5, label: "SIMPLES NACIONAL (CODIGO)", value: d.CodigoOpcaoSimplesNacional},
		{w: contentW * 0.5, label: "REGIME DE APURACAO PELO SN (CODIGO)", value: d.RegimeTributarioSimplesNacional},
	})
	y += 3

	// ── Tomador ──────────────────────────────────────────────────
	y = sectionTitle(pdf, x, y, "TOMADOR / ADQUIRENTE")
	y = row(pdf, x, y, 9, []col{
		{w: contentW * 0.4, label: "CNPJ / CPF / NIF", value: formatCpfCnpj(d.CnpjTomador)},
		{w: contentW * 0.6, label: "NOME / NOME EMPRESARIAL", value: d.RazaoSocialTomador},
	})
	y += 3

	// ── Serviço ──────────────────────────────────────────────────
	y = sectionTitle(pdf, x, y, "SERVICO PRESTADO")
	y = row(pdf, x, y, 9, []col{
		{w: contentW * 0.5, label: "CODIGO DE TRIBUTACAO NACIONAL / MUNICIPAL", value: d.CodigoTributacaoNacionalIss},
		{w: contentW * 0.5, label: "LOCAL DA PRESTACAO / SIGLA UF", value: municipioUF(d.CodigoMunicipioPrestacao)},
	})
	descH := 16.0
	pdf.Rect(x, y, contentW, descH, "D")
	pdf.SetXY(x+1.2, y+0.8)
	pdf.SetFont("Helvetica", "", labelSize)
	pdf.SetTextColor(90, 90, 90)
	pdf.CellFormat(contentW-2.4, 3, latin("DESCRICAO DO SERVICO"), "", 2, "L", false, 0, "")
	pdf.SetX(x + 1.2)
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(20, 20, 20)
	pdf.MultiCell(contentW-2.4, 4.2, latin(d.DescricaoServico), "", "L", false)
	y += descH
	y += 3

	// ── Tributação municipal ─────────────────────────────────────
	y = sectionTitle(pdf, x, y, "TRIBUTACAO MUNICIPAL (ISSQN)")
	y = row(pdf, x, y, 9, []col{
		{w: contentW / 3, label: "TIPO DE TRIBUTACAO DO ISSQN (CODIGO)", value: d.TributacaoIss},
		{w: contentW / 3, label: "REGIME ESPECIAL DE TRIBUTACAO (CODIGO)", value: d.RegimeEspecialTributacao},
		{w: contentW / 3, label: "RETENCAO DO ISSQN (CODIGO)", value: d.TipoRetencaoIss},
	})
	y += 3

	// ── Valor total ──────────────────────────────────────────────
	valor := parseValor(d.ValorServico)
	y = sectionTitle(pdf, x, y, "VALOR TOTAL DA NFS-E")
	y = row(pdf, x, y, 10, []col{
		{w: contentW / 2, label: "VALOR DA OPERACAO / SERVICO", value: fmtBRL(valor), align: "R"},
		{w: contentW / 2, label: "VALOR LIQUIDO DA NFS-E", value: fmtBRL(valor), align: "R"},
	})
	y += 3

	// ── Informações complementares ──────────────────────────────
	y = sectionTitle(pdf, x, y, "INFORMACOES COMPLEMENTARES")
	infoH := 10.0
	pdf.Rect(x, y, contentW, infoH, "D")
	pdf.SetXY(x+2, y+2.5)
	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(20, 20, 20)
	tributos := fmt.Sprintf("Totais aproximados dos tributos cfe. Lei no 12.741/2012: Federais: %s%%; Estaduais: %s%%; Municipais: %s%%.",
		orDash(d.PercentualTotalTributosFederais), orDash(d.PercentualTotalTributosEstaduais), orDash(d.PercentualTotalTributosMunicipais))
	pdf.MultiCell(contentW-4, 4, latin(tributos), "", "L", false)
	y += infoH + 6

	pdf.SetXY(x, y)
	pdf.SetFont("Helvetica", "I", 7.5)
	pdf.SetTextColor(140, 140, 140)
	pdf.CellFormat(contentW, 4, latin("Previa gerada pelo Savicar a partir dos dados preenchidos na tela - nao possui valor fiscal ate a emissao ser confirmada."), "", 1, "C", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func orDash(v string) string {
	if v == "" {
		return "-"
	}
	return v
}
