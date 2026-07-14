package externallookup

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"savicar-api/internal/domain/inventory"
)

const cosmosToken = "aAQz9k94OoCAcIIffX-HHg"

// CosmosClient looks up product info via the Cosmos API (Bluesoft), a
// Brazil-focused GTIN/EAN product database: https://cosmos.bluesoft.com.br/
type CosmosClient struct {
	httpClient *http.Client
	token      string
}

func NewCosmosClient() *CosmosClient {
	return &CosmosClient{httpClient: &http.Client{Timeout: 8 * time.Second}, token: cosmosToken}
}

type cosmosResponse struct {
	Description string `json:"description"`
	Brand       struct {
		Name string `json:"name"`
	} `json:"brand"`
}

func (c *CosmosClient) Lookup(ctx context.Context, barcode string) (*inventory.ExternalProduct, error) {
	url := fmt.Sprintf("https://api.cosmos.bluesoft.com.br/gtins/%s", barcode)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Cosmos-Token", c.token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cosmos: unexpected status %d", resp.StatusCode)
	}

	var body cosmosResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}
	if body.Description == "" {
		return nil, nil
	}
	return &inventory.ExternalProduct{Name: body.Description, Brand: body.Brand.Name}, nil
}
