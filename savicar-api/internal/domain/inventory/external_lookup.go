package inventory

import (
	"context"
	"errors"
)

// ErrLookupQuotaExceeded means an external barcode database refused the lookup because
// the account's quota (daily/plan limit) is used up — not that the product doesn't exist.
var ErrLookupQuotaExceeded = errors.New("A cota de buscas por código de barras está esgotada. Tente novamente mais tarde ou cadastre o produto manualmente.")

type ExternalProduct struct {
	Name  string `json:"name"`
	Brand string `json:"brand"`
}

// ExternalLookup looks up basic product info by barcode from a third-party
// product database, for when the barcode isn't in the local INVENTORY table.
type ExternalLookup interface {
	Lookup(ctx context.Context, barcode string) (*ExternalProduct, error)
}
