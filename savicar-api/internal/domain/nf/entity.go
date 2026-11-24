package nf

// Tipo distinguishes what kind of nota fiscal a row represents.
const (
	TipoNFS = 1 // NFS-e — Nota Fiscal de Serviço
	TipoNF  = 2 // NF-e — Nota Fiscal de Venda
	TipoNFC = 3 // NFC-e — Nota Fiscal de Consumidor
)

type NF struct {
	Numero              int     `json:"numero"`
	Serie               *string `json:"serie"`
	Natureza            *string `json:"natureza"`
	ChaveAcesso         *string `json:"chave_acesso"`
	Protocolo           *string `json:"protocolo"`
	InscricaoEstadual   *string `json:"inscricao_estadual"`
	Cnpj                *string `json:"cnpj"`
	Endereco            *string `json:"endereco"`
	DataEmissao         *string `json:"data_emissao"`
	DataSaida           *string `json:"data_saida"`
	Municipio           *string `json:"municipio"`
	Uf                  *string `json:"uf"`
	BaseIcms            *string `json:"base_icms"`
	ValorIcms           *string `json:"valor_icms"`
	BaseIcmsSt          *string `json:"base_icms_st"`
	ValorIcmsSt         *string `json:"valor_icms_st"`
	ValorFrete          *string `json:"valor_frete"`
	ValorIpi            *string `json:"valor_ipi"`
	ValorTotalProdutos  *string `json:"valor_total_produtos"`
	ValorTotalNota      *string `json:"valor_total_nota"`
	UrlDownload         *string `json:"url_download"`
	Tomador             *string `json:"tomador"`
	Tipo                *int    `json:"tipo"`
}
