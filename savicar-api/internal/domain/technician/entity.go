package technician

type Technician struct {
	IDTechnician int      `json:"id_technician"`
	Name         *string  `json:"name"`
	Salary       *float64 `json:"salary"`
	Percent      *float64 `json:"percent"`
	IDUser       *int     `json:"id_user"`
}
