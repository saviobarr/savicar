package vehiclemake

// Type distinguishes what a make applies to.
const (
	TipoVeiculos = 1 // Veículos
	TipoProdutos = 2 // Produtos
	TipoAmbos    = 3 // Ambos
)

type VehicleMake struct {
	IDMake int     `json:"id_make"`
	Name   *string `json:"name"`
	Type   *int    `json:"type"`
}
