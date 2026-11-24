// When VITE_API_URL is set (e.g. a remote API server), calls go there directly.
// When it is empty (default), calls use a relative path and are forwarded to
// the Go backend by Vite's dev-server proxy (see vite.config.js).
const BASE = import.meta.env.VITE_API_URL ?? ''

export function getToken() { return localStorage.getItem('savicar_token') }
export function setToken(t) { localStorage.setItem('savicar_token', t) }
export function clearToken() { localStorage.removeItem('savicar_token') }
export function getProfile() { return Number(localStorage.getItem('savicar_profile') ?? 0) }
export function setProfile(p) { localStorage.setItem('savicar_profile', String(p)) }
export function clearProfile() { localStorage.removeItem('savicar_profile') }
export function getUserId() { return Number(localStorage.getItem('savicar_user_id') ?? 0) }
export function setUserId(id) { localStorage.setItem('savicar_user_id', String(id)) }
export function clearUserId() { localStorage.removeItem('savicar_user_id') }

function authHeaders() {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers ?? {}) },
  })
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }
  return res
}

export async function login(user_name, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Usuário ou senha inválidos')
  }
  return res.json()
}

export async function fetchImagesByOrder(idOrder) {
  const res = await apiFetch(`${BASE}/service-order-images/order/${idOrder}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function imageFileUrl(idImage) {
  return `${BASE}/service-order-images/${idImage}/file`
}

// ── VehicleMake ──────────────────────────────────────────────
export async function fetchAllVehicleMake(tipo) {
  const url = tipo != null ? `${BASE}/makes?tipo=${tipo}` : `${BASE}/makes`
  const res = await apiFetch(url)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchVehicleMakeById(id) {
  const res = await apiFetch(`${BASE}/makes/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createVehicleMake(data) {
  const res = await apiFetch(`${BASE}/makes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateVehicleMake(id, data) {
  const res = await apiFetch(`${BASE}/makes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteVehicleMake(id) {
  const res = await apiFetch(`${BASE}/makes/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Fuel ─────────────────────────────────────────────────────
export async function fetchAllFuel() {
  const res = await apiFetch(`${BASE}/fuels`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchFuelById(id) {
  const res = await apiFetch(`${BASE}/fuels/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createFuel(data) {
  const res = await apiFetch(`${BASE}/fuels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateFuel(id, data) {
  const res = await apiFetch(`${BASE}/fuels/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteFuel(id) {
  const res = await apiFetch(`${BASE}/fuels/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Technician ───────────────────────────────────────────────
export async function fetchAllTechnician() {
  const res = await apiFetch(`${BASE}/technicians`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchTechnicianById(id) {
  const res = await apiFetch(`${BASE}/technicians/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createTechnician(data) {
  const res = await apiFetch(`${BASE}/technicians`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateTechnician(id, data) {
  const res = await apiFetch(`${BASE}/technicians/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteTechnician(id) {
  const res = await apiFetch(`${BASE}/technicians/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── VehicleModel ─────────────────────────────────────────────
export async function fetchAllVehicleModel() {
  const res = await apiFetch(`${BASE}/models`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchVehicleModelById(id) {
  const res = await apiFetch(`${BASE}/models/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createVehicleModel(data) {
  const res = await apiFetch(`${BASE}/models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateVehicleModel(id, data) {
  const res = await apiFetch(`${BASE}/models/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteVehicleModel(id) {
  const res = await apiFetch(`${BASE}/models/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Customer ─────────────────────────────────────────────────
export async function fetchAllCustomer() {
  const res = await apiFetch(`${BASE}/customers`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchCustomerById(id) {
  const res = await apiFetch(`${BASE}/customers/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createCustomer(data) {
  const res = await apiFetch(`${BASE}/customers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) {
    const text = await res.text()
    let message = text
    try { message = JSON.parse(text).error || text } catch {}
    throw new Error(message)
  }
  return res.json()
}
export async function updateCustomer(id, data) {
  const res = await apiFetch(`${BASE}/customers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteCustomer(id) {
  const res = await apiFetch(`${BASE}/customers/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Contact ───────────────────────────────────────────────────
export async function fetchAllContact() {
  const res = await apiFetch(`${BASE}/contacts`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchContactById(id) {
  const res = await apiFetch(`${BASE}/contacts/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createContact(data) {
  const res = await apiFetch(`${BASE}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateContact(id, data) {
  const res = await apiFetch(`${BASE}/contacts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteContact(id) {
  const res = await apiFetch(`${BASE}/contacts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Country ───────────────────────────────────────────────────
export async function fetchAllCountry() {
  const res = await apiFetch(`${BASE}/countries`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createCountry(data) {
  const res = await apiFetch(`${BASE}/countries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateCountry(id, data) {
  const res = await apiFetch(`${BASE}/countries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteCountry(id) {
  const res = await apiFetch(`${BASE}/countries/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── State ─────────────────────────────────────────────────────
export async function fetchAllState() {
  const res = await apiFetch(`${BASE}/states`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createState(data) {
  const res = await apiFetch(`${BASE}/states`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateState(id, data) {
  const res = await apiFetch(`${BASE}/states/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteState(id) {
  const res = await apiFetch(`${BASE}/states/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── City ──────────────────────────────────────────────────────
export async function fetchAllCity() {
  const res = await apiFetch(`${BASE}/cities`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createCity(data) {
  const res = await apiFetch(`${BASE}/cities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateCity(id, data) {
  const res = await apiFetch(`${BASE}/cities/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteCity(id) {
  const res = await apiFetch(`${BASE}/cities/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── CustomerModel ─────────────────────────────────────────────
export async function fetchAllCustomerModel() {
  const res = await apiFetch(`${BASE}/customer-models`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchCustomerModelById(id) {
  const res = await apiFetch(`${BASE}/customer-models/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createCustomerModel(data) {
  const res = await apiFetch(`${BASE}/customer-models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateCustomerModel(id, data) {
  const res = await apiFetch(`${BASE}/customer-models/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteCustomerModel(id) {
  const res = await apiFetch(`${BASE}/customer-models/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// Looks up vehicle data for a plate — the backend checks our own records
// first, then falls back to the paid external plate-lookup service.
export async function fetchVehicleByPlate(plate) {
  const res = await apiFetch(`${BASE}/vehicle-lookup/${encodeURIComponent(plate)}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Unity ─────────────────────────────────────────────────────
export async function fetchAllUnity() {
  const res = await apiFetch(`${BASE}/unities`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createUnity(data) {
  const res = await apiFetch(`${BASE}/unities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateUnity(id, data) {
  const res = await apiFetch(`${BASE}/unities/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteUnity(id) {
  const res = await apiFetch(`${BASE}/unities/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Appointment Resources ─────────────────────────────────────
export async function fetchAppointmentResourcesByAppointment(idAppointment) {
  const res = await apiFetch(`${BASE}/appointment-resources/by-appointment/${idAppointment}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createAppointmentResource(data) {
  const res = await apiFetch(`${BASE}/appointment-resources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateAppointmentResource(id, data) {
  const res = await apiFetch(`${BASE}/appointment-resources/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteAppointmentResource(id) {
  const res = await apiFetch(`${BASE}/appointment-resources/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Service Appointments ──────────────────────────────────────
export async function fetchAllServiceAppointment() {
  const res = await apiFetch(`${BASE}/appointments`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createServiceAppointment(data) {
  const res = await apiFetch(`${BASE}/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateServiceAppointment(id, data) {
  const res = await apiFetch(`${BASE}/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteServiceAppointment(id) {
  const res = await apiFetch(`${BASE}/appointments/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Resources ────────────────────────────────────────────────
export async function fetchAllResource() {
  const res = await apiFetch(`${BASE}/resources`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createResource(data) {
  const res = await apiFetch(`${BASE}/resources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateResource(id, data) {
  const res = await apiFetch(`${BASE}/resources/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteResource(id) {
  const res = await apiFetch(`${BASE}/resources/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Inventory ─────────────────────────────────────────────────
export async function fetchAllInventory() {
  const res = await apiFetch(`${BASE}/inventory`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchInventoryById(id) {
  const res = await apiFetch(`${BASE}/inventory/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createInventory(data) {
  const res = await apiFetch(`${BASE}/inventory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateInventory(id, data) {
  const res = await apiFetch(`${BASE}/inventory/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteInventory(id) {
  const res = await apiFetch(`${BASE}/inventory/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}
export async function adjustInventoryQuantity(id, delta) {
  const res = await apiFetch(`${BASE}/inventory/${id}/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── ServiceOrder ──────────────────────────────────────────────
export async function fetchAllServiceOrder() {
  const res = await apiFetch(`${BASE}/service-orders`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchServiceOrderById(id) {
  const res = await apiFetch(`${BASE}/service-orders/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createServiceOrder(data) {
  const res = await apiFetch(`${BASE}/service-orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateServiceOrder(id, data) {
  const res = await apiFetch(`${BASE}/service-orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteServiceOrder(id) {
  const res = await apiFetch(`${BASE}/service-orders/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Services ──────────────────────────────────────────────────
export async function fetchAllServices() {
  const res = await apiFetch(`${BASE}/services`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchServicesById(id) {
  const res = await apiFetch(`${BASE}/services/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createServices(data) {
  const res = await apiFetch(`${BASE}/services`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateServices(id, data) {
  const res = await apiFetch(`${BASE}/services/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteServices(id) {
  const res = await apiFetch(`${BASE}/services/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Product Images ────────────────────────────────────────────
export async function fetchProductImages(idProduct) {
  const res = await apiFetch(`${BASE}/product-images/product/${idProduct}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function uploadProductImage(idProduct, file) {
  const fd = new FormData()
  fd.append('id_product', String(idProduct))
  fd.append('image', file)
  const res = await apiFetch(`${BASE}/product-images`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteProductImage(id) {
  const res = await apiFetch(`${BASE}/product-images/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}
export function getProductImageUrl(idImage) {
  return `${BASE}/product-images/${idImage}/file`
}

// ── ServiceOrderProduct ───────────────────────────────────────
export async function fetchServiceOrderProductsByOrder(orderID) {
  const res = await apiFetch(`${BASE}/service-order-products/order/${orderID}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchAllServiceOrderProduct() {
  const res = await apiFetch(`${BASE}/service-order-products`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchServiceOrderProductById(id) {
  const res = await apiFetch(`${BASE}/service-order-products/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createServiceOrderProduct(data) {
  const res = await apiFetch(`${BASE}/service-order-products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateServiceOrderProduct(id, data) {
  const res = await apiFetch(`${BASE}/service-order-products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteServiceOrderProduct(id) {
  const res = await apiFetch(`${BASE}/service-order-products/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── PaymentMethod ─────────────────────────────────────────────
export async function fetchAllPaymentMethod() {
  const res = await apiFetch(`${BASE}/payment-methods`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Payment ───────────────────────────────────────────────────
export async function fetchAllPayments() {
  const res = await apiFetch(`${BASE}/payments`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchPaymentsByOrder(orderID) {
  const res = await apiFetch(`${BASE}/payments/order/${orderID}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createPayment(data) {
  const res = await apiFetch(`${BASE}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updatePayment(id, data) {
  const res = await apiFetch(`${BASE}/payments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deletePayment(id) {
  const res = await apiFetch(`${BASE}/payments/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── OperationalCosts ──────────────────────────────────────────
export async function fetchAllOperationalCosts() {
  const res = await apiFetch(`${BASE}/operational-costs`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchOperationalCostById(id) {
  const res = await apiFetch(`${BASE}/operational-costs/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createOperationalCost(data) {
  const res = await apiFetch(`${BASE}/operational-costs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateOperationalCost(id, data) {
  const res = await apiFetch(`${BASE}/operational-costs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteOperationalCost(id) {
  const res = await apiFetch(`${BASE}/operational-costs/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Financial Report ──────────────────────────────────────────
export async function fetchDailyFinancialReport(dateFrom, dateTo) {
  const to = dateTo || dateFrom
  const res = await apiFetch(`${BASE}/reports/financial/daily?date_from=${dateFrom}&date_to=${to}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── CostCategory ──────────────────────────────────────────────
export async function fetchAllCostCategory() {
  const res = await apiFetch(`${BASE}/cost-categories`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createCostCategory(data) {
  const res = await apiFetch(`${BASE}/cost-categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── TenantConfig ──────────────────────────────────────────────
export async function fetchTenantConfig() {
  const res = await apiFetch(`${BASE}/tenant-config`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateTenantConfig(data) {
  const res = await apiFetch(`${BASE}/tenant-config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── WhatsApp ──────────────────────────────────────────────────
export async function createWhatsAppInstance() {
  const res = await apiFetch(`${BASE}/whatsapp/create-instance`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchWhatsAppStatus() {
  const res = await apiFetch(`${BASE}/whatsapp/status`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function sendServiceOrderWhatsApp(orderId, phoneOverride = '') {
  const res = await apiFetch(`${BASE}/whatsapp/send-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, phone_override: phoneOverride }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Erro ao enviar')
    err.code = data.error
    throw err
  }
  return data
}
export async function confirmWhatsApp() {
  const res = await apiFetch(`${BASE}/whatsapp/confirm`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function disconnectWhatsApp() {
  const res = await apiFetch(`${BASE}/whatsapp/disconnect`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchAllAudit() {
  const res = await apiFetch(`${BASE}/audit`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Notifications ─────────────────────────────────────
export async function fetchAllNotifications() {
  const res = await apiFetch(`${BASE}/notifications`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchUnreadNotificationCount() {
  const res = await apiFetch(`${BASE}/notifications/unread-count`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function markNotificationRead(id) {
  const res = await apiFetch(`${BASE}/notifications/${id}/read`, { method: 'PUT' })
  if (!res.ok) throw new Error(await res.text())
}
export async function markAllNotificationsRead() {
  const res = await apiFetch(`${BASE}/notifications/read-all`, { method: 'PUT' })
  if (!res.ok) throw new Error(await res.text())
}

// ── Users ─────────────────────────────────────────────────────
export async function fetchAllUsers() {
  const res = await apiFetch(`${BASE}/users`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function fetchUserById(id) {
  const res = await apiFetch(`${BASE}/users/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function createUser(data) {
  const res = await apiFetch(`${BASE}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function updateUser(id, data) {
  const res = await apiFetch(`${BASE}/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function deleteUser(id) {
  const res = await apiFetch(`${BASE}/users/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}
