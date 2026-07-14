package externallookup

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"savicar-api/internal/domain/inventory"
)

// UPCItemDBClient looks up product info via UPCItemDB's free trial endpoint
// (https://www.upcitemdb.com/api/explorer#!/lookup/get_trial_lookup). No API
// key required, limited to ~100 requests/day — swap for a paid tier or a
// different provider (e.g. Cosmos/Bluesoft for Brazil-specific coverage) if
// that limit becomes a problem.
type UPCItemDBClient struct {
	httpClient *http.Client
}

func NewUPCItemDBClient() *UPCItemDBClient {
	return &UPCItemDBClient{httpClient: &http.Client{Timeout: 8 * time.Second}}
}

type upcItemDBResponse struct {
	Code  string `json:"code"`
	Items []struct {
		Title string `json:"title"`
		Brand string `json:"brand"`
	} `json:"items"`
}

func (c *UPCItemDBClient) Lookup(ctx context.Context, barcode string) (*inventory.ExternalProduct, error) {
	url := fmt.Sprintf("https://api.upcitemdb.com/prod/trial/lookup?upc=%s", barcode)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("upcitemdb: unexpected status %d", resp.StatusCode)
	}

	var body upcItemDBResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}
	if len(body.Items) == 0 {
		return nil, nil
	}

	item := body.Items[0]
	return &inventory.ExternalProduct{Name: item.Title, Brand: item.Brand}, nil
}
