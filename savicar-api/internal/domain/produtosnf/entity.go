package produtosnf

type ProdutoNf struct {
	IDProduto    int     `json:"id_produto"`
	Numero       *int    `json:"numero"`
	Descricao    *string `json:"descricao"`
	Unidade      *int    `json:"unidade"`
	Quantidade   *int    `json:"quantidade"`
	VlUnitario   *string `json:"vl_unitario"`
	VlTotal      *string `json:"vl_total"`
	BcIcms       *string `json:"bc_icms"`
	VlIcms       *string `json:"vl_icms"`
	AliquotaIcms *string `json:"aliquota_icms"`
}
