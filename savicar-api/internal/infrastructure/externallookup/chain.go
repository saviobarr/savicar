package externallookup

import (
	"context"
	"errors"

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
	quotaHit := false
	for _, l := range c.lookups {
		product, err := l.Lookup(ctx, barcode)
		if err != nil {
			if errors.Is(err, inventory.ErrLookupQuotaExceeded) {
				quotaHit = true
			}
			lastErr = err
			continue
		}
		if product != nil {
			return product, nil
		}
	}
	// Nobody found it. If a source refused for lack of quota, the product may well
	// exist there — say so instead of reporting a plain "not found".
	if quotaHit {
		return nil, inventory.ErrLookupQuotaExceeded
	}
	return nil, lastErr
}
