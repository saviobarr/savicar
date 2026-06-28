package vehiclemodel

type VehicleModel struct {
	IDModel int     `json:"id_model"`
	IDMake  *int    `json:"id_make"`
	Name    *string `json:"name"`
	Version *string `json:"version"`
	IDFuel  *int    `json:"id_fuel"`
}
