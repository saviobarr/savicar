package inventory

type Inventory struct {
	IDProduct                  int      `json:"id_product"`
	Name                       *string  `json:"name"`
	Code                       *string  `json:"code"`
	Provider                   *string  `json:"provider"`
	IDMake                     *int     `json:"id_make"`
	MakerCode                  *string  `json:"maker_code"`
	ProviderCode               *string  `json:"provider_code"`
	InternalCode               *string  `json:"internal_code"`
	IDUnity                    *int     `json:"id_unity"`
	UnityDescription           *string  `json:"unity_description"`
	GrossWeight                *int     `json:"gross_weight"`
	NetWeight                  *int     `json:"net_weight"`
	StorageLocation            *string  `json:"storage_location"`
	Min                        *int     `json:"min"`
	Max                        *int     `json:"max"`
	GtinEanCode                *string  `json:"gtin_ean_code"`
	OriginalNumber             *string  `json:"original_number"`
	SalesPrice                 *float64 `json:"sales_price"`
	CostPrice                  *float64 `json:"cost_price"`
	ProductSize                string   `json:"product_size"`
	ProductOrigin              *int     `json:"product_origin"`
	ClassificationType         *int     `json:"classification_type"`
	InitialInventoryQuantity   *int     `json:"initial_inventory_quantity"`
	CurrentQuantity            *int     `json:"current_quantity"`
	ProductDetails             *string  `json:"product_details"`
	ImagePath                  *string  `json:"image_path"`
}
