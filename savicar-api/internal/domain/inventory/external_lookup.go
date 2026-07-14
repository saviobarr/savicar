package inventory

import "context"

type ExternalProduct struct {
	Name  string `json:"name"`
	Brand string `json:"brand"`
}

// ExternalLookup looks up basic product info by barcode from a third-party
// product database, for when the barcode isn't in the local INVENTORY table.
type ExternalLookup interface {
	Lookup(ctx context.Context, barcode string) (*ExternalProduct, error)
}
