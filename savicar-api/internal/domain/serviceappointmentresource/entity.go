package serviceappointmentresource

type ServiceAppointmentResource struct {
	IDServiceAppointmentResource int  `json:"id_service_appointment_resource"`
	IDServiceAppointment         int  `json:"id_service_appointment"`
	IDResource                   *int `json:"id_resource"`
	IDTechnician                 *int `json:"id_technician"`
	// Derived via JOINs — read-only
	ResourceDescription *string `json:"resource_description"`
	TechnicianName      *string `json:"technician_name"`
}
