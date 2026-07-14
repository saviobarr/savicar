package externallookup

import (
	"context"

	"savicar-api/internal/domain/inventory"
)

// ChainLookup tries each ExternalLookup in order and returns the first hit.
// A lookup that errors (e.g. network failure) doesn't abort the chain —
// the next source is tried instead.
type ChainLookup struct {
	lookups []inventory.ExternalLookup
}

func NewChainLookup(lookups ...inventory.ExternalLookup) *ChainLookup {
	return &ChainLookup{lookups: lookups}
}

func (c *ChainLookup) Lookup(ctx context.Context, barcode string) (*inventory.ExternalProduct, error) {
	var lastErr error
	for _, l := range c.lookups {
		product, err := l.Lookup(ctx, barcode)
		if err != nil {
			lastErr = err
			continue
		}
		if product != nil {
			return product, nil
		}
	}
	return nil, lastErr
}
