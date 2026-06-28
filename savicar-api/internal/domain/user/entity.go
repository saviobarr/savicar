package user

type Profile int

const (
	ProfileAdmin      Profile = 1
	ProfileManager    Profile = 2
	ProfileTechnician Profile = 3
)

type User struct {
	IDUser   int     `json:"id_user"`
	IDTenant int     `json:"id_tenant"`
	Name     string  `json:"name"`
	UserName string  `json:"user_name"`
	Password string  `json:"password,omitempty"`
	Profile  Profile `json:"profile"`
}
