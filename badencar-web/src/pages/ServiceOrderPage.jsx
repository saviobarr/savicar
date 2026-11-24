import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getProfile, getUserId } from '../api'
import { useNavigate, useLocation } from 'react-router-dom'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import { loadFilters, saveFilters } from '../filterStorage'
import { matchesSearchQuery } from '../searchUtils'
import { matchVehicleModel } from '../vehicleLookup'
import { CustomerForm } from './CustomerPage'
import { TechnicianForm } from './TechnicianPage'
import {
  fetchAllServiceOrder,
  fetchTenantConfig,
  fetchAllCity,
  fetchAllState,
  sendServiceOrderWhatsApp,
  createServiceOrder,
  updateServiceOrder,
  deleteServiceOrder,
  fetchAllCustomer,
  fetchAllCustomerModel,
  createCustomerModel,
  updateCustomerModel,
  fetchVehicleByPlate,
  fetchAllVehicleMake,
  fetchAllVehicleModel,
  createVehicleModel,
  fetchAllTechnician,
  fetchAllServices,
  createServices,
  updateServices,
  deleteServices,
  fetchAllInventory,
  createInventory,
  fetchServiceOrderProductsByOrder,
  createServiceOrderProduct,
  updateServiceOrderProduct,
  deleteServiceOrderProduct,
  fetchAllPaymentMethod,
  fetchPaymentsByOrder,
  createPayment,
  updatePayment,
  deletePayment,
} from '../api'
import { serverNow, serverTodayISO, localISODate } from '../serverClock'

function customerDisplayName(c) {
  return c.individual_name || c.trade_name || c.legal_name || `Cliente #${c.id_customer}`
}

function CustomerAutocomplete({ value, onChange, customers = [] }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (value && customers.length) {
      const found = customers.find(c => c.id_customer === Number(value))
      if (found) setQuery(customerDisplayName(found))
    }
    if (!value) setQuery('')
  }, [value, customers])

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    if (!q.trim()) {
      onChange('')
      setSuggestions(customers)
      setOpen(customers.length > 0)
      return
    }
    const lower = q.toLowerCase()
    const matches = customers.filter(c =>
      customerDisplayName(c).toLowerCase().includes(lower) ||
      String(c.id_customer).includes(q) ||
      (c.tax_id || '').includes(q)
    )
    setSuggestions(matches)
    setOpen(true)
  }

  function handleSelect(c) {
    setQuery(customerDisplayName(c))
    setSuggestions([])
    setOpen(false)
    onChange(c.id_customer)
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="autocomplete-wrapper" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => {
          if (!query.trim()) {
            setSuggestions(customers)
            setOpen(customers.length > 0)
          } else {
            setOpen(suggestions.length > 0)
          }
        }}
        placeholder="Digite o nome ou CPF/CNPJ..."
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map(c => (
            <li key={c.id_customer} onMouseDown={() => handleSelect(c)}>
              <span className="autocomplete-name">{customerDisplayName(c)}</span>
              <span className="autocomplete-meta">#{c.id_customer}{c.tax_id ? ` · ${c.tax_id}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SelectAutocomplete({ items, value, onChange, getLabel, getId, placeholder, disabled, maxSuggestions = 10 }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (value && items.length) {
      const found = items.find(i => String(getId(i)) === String(value))
      if (found) setQuery(getLabel(found))
    } else if (!value) {
      setQuery('')
    }
  }, [value, items])

  // Re-open dropdown when items load while input is already focused with no query
  useEffect(() => {
    if (focusedRef.current && !query.trim() && items.length > 0) {
      openDropdown(items.slice(0, maxSuggestions))
    }
  }, [items])

  function openDropdown(list) {
    if (!list.length) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 2,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
    setSuggestions(list)
    setOpen(true)
  }

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    if (!q.trim()) {
      onChange('')
      openDropdown(items.slice(0, maxSuggestions))
      return
    }
    const matches = items.filter(i => matchesSearchQuery(getLabel(i) || '', q)).slice(0, maxSuggestions)
    openDropdown(matches)
  }

  function handleFocus() {
    focusedRef.current = true
    if (!query.trim()) {
      openDropdown(items.slice(0, maxSuggestions))
    } else if (suggestions.length) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownStyle({ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: rect.width, zIndex: 9999 })
      setOpen(true)
    }
  }

  function handleSelect(item) {
    setQuery(getLabel(item))
    setSuggestions([])
    setOpen(false)
    onChange(getId(item))
  }

  useEffect(() => {
    function handleClickOutside(e) {
      const inInput = inputRef.current && inputRef.current.contains(e.target)
      if (inInput) return
      if (listRef.current) {
        const rect = listRef.current.getBoundingClientRect()
        const inList = e.clientX >= rect.left && e.clientX <= rect.right &&
                       e.clientY >= rect.top && e.clientY <= rect.bottom
        if (inList) return
      }
      focusedRef.current = false
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="autocomplete-wrapper">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={() => { focusedRef.current = false; setOpen(false) }}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      {open && suggestions.length > 0 && createPortal(
        <ul ref={listRef} className="autocomplete-list" style={dropdownStyle}>
          {suggestions.map(item => (
            <li key={getId(item)} onMouseDown={e => { e.preventDefault(); handleSelect(item) }}>
              <span className="autocomplete-name">{getLabel(item)}</span>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}

function customerModelDisplayName(m) {
  const parts = [m.model_name, m.plate].filter(Boolean)
  return parts.join(' · ') || `Veículo #${m.id_customer_model}`
}

function CustomerModelAutocomplete({ value, onChange, idCustomer, allModels }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const disabled = false // always enabled — car can be selected before customer

  // When a customer is selected filter by that customer; otherwise show all cars
  const customerModels = idCustomer
    ? allModels.filter(m => m.id_customer === Number(idCustomer))
    : allModels

  // Reset display when the customer changes — but NOT when a model is already
  // pre-selected (that would erase the vehicle the user expects to see).
  useEffect(() => {
    if (!value) {
      setQuery('')
      setSuggestions([])
      setOpen(false)
    }
  }, [idCustomer])

  useEffect(() => {
    if (value && allModels.length) {
      const found = allModels.find(m => m.id_customer_model === Number(value))
      if (found) setQuery(customerModelDisplayName(found))
    } else if (!value) {
      setQuery('')
    }
  }, [value, allModels])

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    if (!q.trim()) {
      onChange('')
      setSuggestions(customerModels.slice(0, 10))
      setOpen(customerModels.length > 0)
      return
    }
    const lower = q.toLowerCase()
    const matches = customerModels.filter(m =>
      customerModelDisplayName(m).toLowerCase().includes(lower) ||
      String(m.id_customer_model).includes(q)
    ).slice(0, 10)
    setSuggestions(matches)
    setOpen(true)
  }

  function handleFocus() {
    if (!query.trim()) {
      setSuggestions(customerModels.slice(0, 10))
      setOpen(customerModels.length > 0)
    } else if (suggestions.length) {
      setOpen(true)
    }
  }

  function handleSelect(m) {
    setQuery(customerModelDisplayName(m))
    setSuggestions([])
    setOpen(false)
    onChange(m.id_customer_model)
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="autocomplete-wrapper" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={handleFocus}
        placeholder={disabled ? 'Selecione um cliente primeiro...' : 'Digite a placa, ano ou cor...'}
        autoComplete="off"
        disabled={disabled}
      />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map(m => (
            <li key={m.id_customer_model} onMouseDown={() => handleSelect(m)}>
              <span className="autocomplete-name">{customerModelDisplayName(m)}</span>
              <span className="autocomplete-meta">#{m.id_customer_model}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NewVehicleModelModal({ idMake, makeName, onSaved, onCancel }) {
  const [form, setForm] = useState({ name: '', version: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    e.stopPropagation()
    setSaving(true)
    setError(null)
    try {
      const created = await createVehicleModel({ ...form, id_make: idMake })
      onSaved(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="form-modal-overlay">
      <div className="form-modal" onClick={e => e.stopPropagation()}>
        <div className="form-modal-header">
          <span>Novo Modelo — {makeName}</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="crud-form">
          <div className="form-group">
            <label>Nome</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} autoFocus required />
          </div>
          <div className="form-group">
            <label>Versão</label>
            <input type="text" name="version" value={form.version} onChange={handleChange} />
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" onClick={onCancel}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export function NewCustomerModal({ onSaved, onCancel }) {
  return createPortal(
    <div className="form-modal-overlay">
      <div className="form-modal" onClick={e => e.stopPropagation()}>
        <div className="form-modal-header">
          <span>Novo Cliente</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <CustomerForm initialData={null} onSaved={onSaved} onCancel={onCancel} />
      </div>
    </div>,
    document.body
  )
}

export function NewTechnicianModal({ onSaved, onCancel }) {
  return createPortal(
    <div className="form-modal-overlay">
      <div className="form-modal" onClick={e => e.stopPropagation()}>
        <div className="form-modal-header">
          <span>Novo Técnico</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <TechnicianForm initialData={null} onSaved={onSaved} onCancel={onCancel} />
      </div>
    </div>,
    document.body
  )
}

export function NewCarModal({ idCustomer, onSaved, onCancel }) {
  const [car, setCar] = useState({ id_make: '', id_model: '', plate: '', vin: '', year_make: '', year_model: '', color: '' })
  const [makes, setMakes] = useState([])
  const [vehicleModels, setVehicleModels] = useState([])
  const [newModelOpen, setNewModelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState(null)

  useEffect(() => {
    fetchAllVehicleMake(1)
      .then(list => setMakes([...list].sort((a, b) => (a.name ?? '').toLowerCase().localeCompare((b.name ?? '').toLowerCase()))))
      .catch(() => {})
    fetchAllVehicleModel().then(setVehicleModels).catch(() => {})
  }, [])

  async function handleLookupPlate() {
    if (!car.plate.trim()) return
    setLookingUp(true)
    setLookupError(null)
    try {
      const result = await fetchVehicleByPlate(car.plate.trim())
      const model = matchVehicleModel(result, makes, vehicleModels)
      setCar(prev => ({
        ...prev,
        plate: result.plate || prev.plate,
        year_make: result.year_make || prev.year_make,
        year_model: result.year_model || prev.year_model,
        color: result.color || prev.color,
        vin: result.chassis ? result.chassis.toUpperCase().replace(/\s/g, '') : prev.vin,
        id_model: model ? model.id_model : prev.id_model,
        id_make: model?.id_make != null ? String(model.id_make) : prev.id_make,
      }))
      if (!model) {
        setLookupError('Veículo encontrado, mas não foi possível identificar o modelo automaticamente. Selecione manualmente.')
      }
    } catch (err) {
      setLookupError(err.message || 'Erro ao consultar placa')
    } finally {
      setLookingUp(false)
    }
  }

  function handleNewModelSaved(created) {
    const newModel = { ...created, id_make: car.id_make }
    setVehicleModels(prev => [...prev, newModel])
    setCar(prev => ({ ...prev, id_model: newModel.id_model }))
    setNewModelOpen(false)
  }

  const filteredModels = (car.id_make
    ? vehicleModels.filter(m => String(m.id_make) === String(car.id_make))
    : vehicleModels
  ).slice().sort((a, b) => {
    const nameA = `${a.name ?? ''}${a.version ? ` ${a.version}` : ''}`.toLowerCase()
    const nameB = `${b.name ?? ''}${b.version ? ` ${b.version}` : ''}`.toLowerCase()
    return nameA.localeCompare(nameB)
  })

  function handleChange(e) {
    const { name, value } = e.target
    if (name === 'id_make') {
      setCar(prev => ({ ...prev, id_make: value, id_model: '' }))
    } else {
      setCar(prev => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!idCustomer) {
      setError('Antes de inserir um novo veículo no cadastro, selecione o cliente/responsável.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { id_make, ...carPayload } = car
      const created = await createCustomerModel({
        ...carPayload,
        id_model: carPayload.id_model ? Number(carPayload.id_model) : undefined,
        year_make: carPayload.year_make !== '' ? Number(carPayload.year_make) : undefined,
        year_model: carPayload.year_model !== '' ? Number(carPayload.year_model) : undefined,
        vin: carPayload.vin.trim() || null,
        id_customer: Number(idCustomer),
      })
      onSaved(created)
    } catch (err) {
      const msg = err.message ?? ''
      if (msg.includes('foreign key') || msg.includes('FK_CUSTOMER_MODEL') || msg.includes('ID_CUSTOMER')) {
        setError('Antes de inserir um novo veículo no cadastro, selecione o cliente/responsável.')
      } else {
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <>
    <div className="form-modal-overlay">
      <div className="form-modal" onClick={e => e.stopPropagation()}>
        <div className="form-modal-header">
          <span>Novo Veículo do Cliente</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="crud-form">
          <div className="form-group">
            <label>Placa</label>
            <div className="plate-search-field">
              <input type="text" name="plate" value={car.plate} onChange={handleChange} autoFocus />
              <button
                type="button"
                className="btn-plate-search"
                onClick={handleLookupPlate}
                disabled={lookingUp || !car.plate.trim()}
                title="Buscar dados do veículo pela placa"
              >{lookingUp ? '⏳' : '🔍'}</button>
            </div>
            {lookupError && <p className="error">{lookupError}</p>}
          </div>
          <div className="form-group">
            <label>Marca</label>
            <SelectAutocomplete
              items={makes}
              value={car.id_make}
              onChange={val => setCar(prev => ({ ...prev, id_make: val, id_model: '' }))}
              getId={mk => mk.id_make}
              getLabel={mk => mk.name}
              placeholder="Digite ou selecione a marca..."
            />
          </div>
          <div className="form-group">
            <label>Modelo</label>
            <div className="autocomplete-with-add">
              <SelectAutocomplete
                items={filteredModels}
                value={car.id_model}
                onChange={val => setCar(prev => ({ ...prev, id_model: val }))}
                getId={m => m.id_model}
                getLabel={m => (m.name || '') + (m.version ? ` ${m.version}` : '')}
                placeholder="Digite para buscar o modelo..."
                maxSuggestions={200}
              />
              <button
                type="button"
                className="btn-add-inline"
                onClick={() => setNewModelOpen(true)}
                disabled={!car.id_make}
                title="Cadastrar novo modelo"
              >+</button>
            </div>
          </div>
          <div className="form-group">
            <label>Ano Fabricação</label>
            <input type="number" name="year_make" value={car.year_make} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Ano Modelo</label>
            <input type="number" name="year_model" value={car.year_model} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Cor</label>
            <input type="text" name="color" value={car.color} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Chassi (VIN)</label>
            <input
              type="text"
              name="vin"
              value={car.vin}
              onChange={e => setCar(prev => ({ ...prev, vin: e.target.value.toUpperCase().replace(/\s/g, '') }))}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" onClick={onCancel}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
    {newModelOpen && (
      <NewVehicleModelModal
        idMake={car.id_make}
        makeName={makes.find(mk => mk.id_make === Number(car.id_make))?.name ?? ''}
        onSaved={handleNewModelSaved}
        onCancel={() => setNewModelOpen(false)}
      />
    )}
    </>,
    document.body
  )
}

function fmtDatetimeBR(val) {
  if (!val) return null
  const d = new Date(val)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`
}

function DetailRow({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

async function printServiceOrder(data, services, products, payments, inventoryItems) {
  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const isoToBR = iso => {
    if (!iso) return ''
    const parts = iso.slice(0, 10).split('-')
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ''
  }
  const totalAmount = data.total_amount != null ? Number(data.total_amount) : 0
  const discount    = data.discount    != null ? Number(data.discount)    : 0
  const finalAmount = data.final_amount != null ? Number(data.final_amount) : totalAmount - discount
  const totalPago   = payments.reduce((acc, p) => acc + (p.payment_date ? Number(p.value || 0) : 0), 0)
  const totalAberto = finalAmount - totalPago

  const row = (label, value) => value != null && value !== '' ? `<tr><td class="lbl">${label}</td><td>${value}</td></tr>` : ''
  const rowPair = (l1, v1, l2, v2) => `<tr><td class="lbl">${l1}</td><td style="width:35%">${v1 ?? ''}</td><td class="lbl">${l2}</td><td>${v2 ?? ''}</td></tr>`

  const servicesHtml = services.length > 0 ? `
    <h3>Serviços</h3>
    <table class="tbl"><thead><tr><th>Descrição</th><th>Horas</th><th>Valor Unit.</th><th>Total</th></tr></thead><tbody>
    ${services.map(s => `<tr>
      <td>${s.description ?? ''}</td>
      <td>${s.hours_quantity ?? ''}</td>
      <td>${s.unit_value != null ? fmt(s.unit_value) : ''}</td>
      <td>${s.total_value != null ? fmt(s.total_value) : ''}</td>
    </tr>`).join('')}
    </tbody></table>` : ''

  const productsHtml = products.length > 0 ? `
    <h3>Produtos</h3>
    <table class="tbl"><thead><tr><th>Produto</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr></thead><tbody>
    ${products.map(p => {
      const inv = inventoryItems.find(i => i.id_product === Number(p.id_product))
      const price = lineUnitPrice(p, inv)
      const lineTotal = price != null && p.quantity ? price * Number(p.quantity) : null
      return `<tr>
        <td>${p.product_name ?? inv?.name ?? p.id_product}</td>
        <td>${p.quantity}</td>
        <td>${price != null ? fmt(price) : ''}</td>
        <td>${lineTotal != null ? fmt(lineTotal) : ''}</td>
      </tr>`
    }).join('')}
    </tbody></table>` : ''

  const paymentsHtml = payments.length > 0 ? `
    <h3>Pagamentos</h3>
    <table class="tbl"><thead><tr><th>Forma</th><th>Vencimento</th><th>Pagamento</th><th>Valor</th></tr></thead><tbody>
    ${payments.map(p => `<tr>
      <td>${p.payment_method_description ?? ''}</td>
      <td>${isoToBR(p.due_date)}</td>
      <td>${isoToBR(p.payment_date)}</td>
      <td>${p.value != null ? fmt(p.value) : ''}</td>
    </tr>`).join('')}
    </tbody></table>` : ''

  const apiBase = import.meta.env.VITE_API_URL ?? ''

  // Fetch tenant info for the header
  let tenantHtml = ''
  try {
    const [cfg, cities, allStates] = await Promise.all([fetchTenantConfig(), fetchAllCity(), fetchAllState()])
    const city = cfg?.id_city ? cities.find(c => c.id_city === cfg.id_city) : null
    const stateAbbr = city?.id_state ? (allStates.find(s => s.id_state === city.id_state)?.abbreviation ?? '') : ''
    const cityName = city ? [city.name, stateAbbr].filter(Boolean).join(' - ') : ''
    const parts = []
    if (cfg?.exhibition_name) parts.push(`<div style="font-size:15px;font-weight:bold;margin-bottom:2px">${cfg.exhibition_name}</div>`)
    const addrCity = [cfg?.address, cityName].filter(Boolean).join(' — ')
    if (addrCity) parts.push(`<div>${addrCity}</div>`)
    const phoneMail = []
    if (cfg?.phone_number) phoneMail.push(cfg.phone_number)
    if (cfg?.email)        phoneMail.push(cfg.email)
    if (phoneMail.length)  parts.push(`<div>${phoneMail.join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</div>`)
    if (cfg?.tax_id)       parts.push(`<div>CNPJ/CPF: ${cfg.tax_id}</div>`)
    tenantHtml = parts.join('')
  } catch {}

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>OS #${data.id_order}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    h3 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    table.info { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: auto; }
    table.info td { padding: 1px 8px 1px 4px; vertical-align: top; }
    table.info td.lbl { font-weight: bold; color: #444; white-space: nowrap; width: 1%; padding-right: 4px; }
    table.tbl { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    table.tbl th, table.tbl td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 11px; }
    table.tbl th { background: #f0f0f0; }
    .totals { margin-top: 12px; }
    .totals table.info td.lbl { width: 60%; }
    .doc-header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 12px; }
    .logo { max-height: 70px; }
    .tenant-info { font-size: 11px; color: #333; line-height: 1.7; }
    .signature { margin-top: 48px; font-size: 12px; line-height: 2.2; }
    .signature-line { border-bottom: 1px solid #111; display: inline-block; width: 280px; }
    @media print { body { margin: 12px; } }
  </style>
  </head><body>
  <div class="doc-header">
    <img src="${apiBase}/tenant-config/logo" class="logo" onerror="this.style.display='none'" />
    <div class="tenant-info">${tenantHtml}</div>
  </div>
  <h1>Ordem de Serviço #${data.id_order}</h1>
  <table class="info">
    ${data.customer_name || data.customer_phone ? `<tr><td class="lbl">Cliente</td><td>${[data.customer_name, data.customer_phone].filter(Boolean).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</td></tr>` : ''}
    ${rowPair('Modelo', data.model_name, 'Placa', data.plate_number)}
    ${row('Tipo de Serviço', data.service_type)}
    ${rowPair('Técnico', data.technician_name, 'Data/Hora Entrada', fmtDatetimeBR(data.date_time_in))}
    ${row('Data/Hora Saída', fmtDatetimeBR(data.date_time_out))}
    ${row('Chassi (VIN)', data.vin)}
    ${row('Hodômetro (km)', data.odometer_reading)}
    ${row('Obs. do Cliente', data.customer_notes)}
    ${row('Observações Gerais', data.remarks)}
    ${row('Diagnóstico', data.diagnosis_notes)}
  </table>
  ${servicesHtml}
  ${productsHtml}
  ${paymentsHtml}
  <div class="totals">
    <table class="info">
      ${row('Total OS', fmt(totalAmount))}
      ${discount !== 0 ? row('Desconto', fmt(discount)) : ''}
      ${row('Valor Final', fmt(finalAmount))}
      ${row('Total Pago', fmt(totalPago))}
      ${row('Total Aberto', fmt(totalAberto))}
    </table>
  </div>
  <div class="signature">
    <p>Blumenau _____ de ______________ de 20_______</p>
    <p style="margin-top:32px">Ciente e de acordo</p>
    <p>Assinatura cliente/seguradora: <span class="signature-line"></span></p>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

function WppSendModal({ order, onClose }) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [phoneNeeded, setPhoneNeeded] = useState(null) // null | 'no_phone' | 'invalid_whatsapp_number'
  const [phoneNeededMessage, setPhoneNeededMessage] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSend(phoneOverride) {
    setSending(true)
    setError(null)
    try {
      await sendServiceOrderWhatsApp(order.id_order, phoneOverride ?? '')
      setSent(true)
    } catch (e) {
      if (e.code === 'no_phone' || e.code === 'invalid_whatsapp_number') {
        setPhoneNeeded(e.code)
        setPhoneNeededMessage(e.message)
        setSending(false)
        return
      }
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return createPortal(
    <div className="form-modal-overlay" onClick={onClose}>
      <div className="form-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="form-modal-header">
          <span>Enviar OS #{order.id_order} via WhatsApp</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {sent ? (
          <div style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ color: '#4ade80', fontWeight: 600 }}>PDF enviado com sucesso!</p>
            <button className="btn-novo" style={{ marginTop: '1rem' }} onClick={onClose}>Fechar</button>
          </div>
        ) : phoneNeeded ? (
          <div style={{ padding: '1rem' }}>
            <p style={{ color: '#f59e0b', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              {phoneNeededMessage || 'O cliente não possui número de WhatsApp cadastrado. Informe o número abaixo:'}
            </p>
            <div className="form-group">
              <label>Número WhatsApp (com DDI e DDD)</label>
              <input
                type="tel"
                value={manualPhone}
                onChange={e => setManualPhone(e.target.value)}
                placeholder="Ex: 5511999999999"
                autoFocus
              />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button className="btn-novo" onClick={() => handleSend(manualPhone)} disabled={sending || !manualPhone.trim()} style={{ background: '#25d366' }}>
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
              <button type="button" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '1rem' }}>
            <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>
              O PDF da OS <strong style={{ color: '#e2e8f0' }}>#{order.id_order}</strong> será enviado para o WhatsApp cadastrado do cliente <strong style={{ color: '#e2e8f0' }}>{order.customer_name}</strong>.
            </p>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button className="btn-novo" onClick={() => handleSend()} disabled={sending} style={{ background: '#25d366' }}>
                {sending ? 'Gerando e enviando...' : 'Confirmar Envio'}
              </button>
              <button type="button" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function ServiceOrderDetailFull({ data }) {
  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [payments, setPayments] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [sendWpp, setSendWpp] = useState(false)
  const [wppOpen, setWppOpen] = useState(false)

  function isoToBR(iso) {
    if (!iso) return ''
    const parts = iso.slice(0, 10).split('-')
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ''
  }

  useEffect(() => {
    fetchTenantConfig().then(cfg => setSendWpp(cfg?.send_wpp === 1)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchAllServices().then(all => (all ?? []).filter(s => s.id_order === data.id_order)),
      fetchServiceOrderProductsByOrder(data.id_order).then(d => d ?? []),
      fetchPaymentsByOrder(data.id_order).then(d => d ?? []),
      fetchAllInventory().then(d => d ?? []),
    ])
      .then(([svcs, prods, pays, inv]) => {
        setServices(svcs)
        setProducts(prods)
        setPayments(pays)
        setInventoryItems(inv)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [data.id_order])

  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const totalAmount = data.total_amount != null ? Number(data.total_amount) : 0
  const discount    = data.discount    != null ? Number(data.discount)    : 0
  const finalAmount = data.final_amount != null ? Number(data.final_amount) : totalAmount - discount
  const totalPago   = payments.reduce((acc, p) => acc + (p.payment_date ? Number(p.value || 0) : 0), 0)
  const totalAberto = finalAmount - totalPago

  return (
    <div className="detail-body">
      <DetailRow label="OS"                value={data.id_order} />
      <DetailRow label="Cliente"           value={data.customer_name} />
      <DetailRow label="Modelo"            value={data.model_name} />
      <DetailRow label="Placa"             value={data.plate_number} />
      <DetailRow label="Tipo de Serviço"   value={data.service_type} />
      <DetailRow label="Técnico"           value={data.technician_name} />
      <DetailRow label="Data/Hora Entrada" value={fmtDatetimeBR(data.date_time_in)} />
      <DetailRow label="Data/Hora Saída"   value={fmtDatetimeBR(data.date_time_out)} />
      <DetailRow label="Chassi (VIN)"       value={data.vin} />
      <DetailRow label="Hodômetro (km)"    value={data.odometer_reading} />
      <DetailRow label="Obs. do Cliente"   value={data.customer_notes} />
      <DetailRow label="Obs. Internas"     value={data.internal_notes} />
      <DetailRow label="Observações Gerais" value={data.remarks} />
      <DetailRow label="Diagnóstico"       value={data.diagnosis_notes} />

      {loading && <p style={{ fontSize: '0.85rem', color: '#888', marginTop: 12 }}>Carregando...</p>}

      {!loading && services.length > 0 && (
        <div className="contact-section" style={{ marginTop: 16 }}>
          <div className="contact-section-header"><span>Serviços</span></div>
          <table className="services-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Horas</th>
                <th>Valor Unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s, idx) => (
                <tr key={s.id_service ?? idx}>
                  <td>{s.description ?? ''}</td>
                  <td>{s.hours_quantity ?? ''}</td>
                  <td>{s.unit_value != null ? Number(s.unit_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                  <td>{s.total_value != null ? Number(s.total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="section-total">
            Total de Serviços: {services
              .reduce((acc, s) => Number(s.status) === 6 ? acc : acc + (s.total_value != null ? Number(s.total_value) : 0), 0)
              .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="contact-section" style={{ marginTop: 16 }}>
          <div className="contact-section-header"><span>Produtos</span></div>
          <table className="services-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Valor Unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => {
                const inv = inventoryItems.find(i => i.id_product === Number(p.id_product))
                const price = lineUnitPrice(p, inv)
                const lineTotal = price != null && p.quantity ? price * Number(p.quantity) : null
                return (
                  <tr key={p.id_service_order_product ?? idx}>
                    <td>{p.product_name ?? inv?.name ?? p.id_product}</td>
                    <td>{p.quantity}</td>
                    <td>{price != null ? price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                    <td>{lineTotal != null ? lineTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="section-total">
            Total de Produtos: {products
              .reduce((acc, p) => {
                const inv = inventoryItems.find(i => i.id_product === Number(p.id_product))
                const price = lineUnitPrice(p, inv)
        return acc + (price != null ? price * Number(p.quantity || 0) : 0)
              }, 0)
              .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
      )}

      {!loading && payments.length > 0 && (
        <div className="contact-section" style={{ marginTop: 16 }}>
          <div className="contact-section-header"><span>Pagamentos</span></div>
          <table className="services-table">
            <thead>
              <tr>
                <th>Forma</th>
                <th>Vencimento</th>
                <th>Pagamento</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, idx) => (
                <tr key={p.id_payment ?? idx}>
                  <td>{p.payment_method_description ?? ''}</td>
                  <td>{isoToBR(p.due_date)}</td>
                  <td>{isoToBR(p.payment_date)}</td>
                  <td>{p.value != null ? Number(p.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <div style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <DetailRow label="Total OS"     value={fmt(totalAmount)} />
          {discount !== 0 && <DetailRow label="Desconto"    value={fmt(discount)} />}
          <DetailRow label="Valor Final"  value={fmt(finalAmount)} />
          <DetailRow label="Total Pago"   value={fmt(totalPago)} />
          <DetailRow label="Total Aberto" value={fmt(totalAberto)} />
        </div>
      )}

      {!loading && (
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {sendWpp && (
            <button
              className="btn-novo"
              style={{ background: '#25d366' }}
              onClick={() => setWppOpen(true)}
            >
              WhatsApp
            </button>
          )}
          <button
            className="btn-novo"
            onClick={() => printServiceOrder(data, services, products, payments, inventoryItems)}
          >
            Imprimir
          </button>
        </div>
      )}
      {wppOpen && <WppSendModal order={data} onClose={() => setWppOpen(false)} />}
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 0, label: 'Orçamento' },
  { value: 1, label: 'Aberta' },
  { value: 2, label: 'Em Andamento' },
  { value: 3, label: 'Aguardando Peças' },
  { value: 4, label: 'Em Teste' },
  { value: 5, label: 'Concluído' },
]

const STATUS_STYLE = {
  0: { background: '#374151',  color: '#9ca3af' },
  1: { background: '#555965',  color: '#e0e0e0' },
  2: { background: '#b89a00',  color: '#1a1a1a' },
  3: { background: '#3a6ea8',  color: '#fff'    },
  4: { background: '#a0611a',  color: '#fff'    },
  5: { background: '#27863f',  color: '#fff'    },
}

function StatusBadge({ value }) {
  const opt = STATUS_OPTIONS.find(o => o.value === Number(value))
  if (!opt) return <span style={{ color: '#aaa' }}>—</span>
  const style = STATUS_STYLE[opt.value] ?? {}
  return (
    <span style={{
      ...style,
      padding: '3px 10px',
      borderRadius: '12px',
      fontSize: '0.78rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {opt.label}
    </span>
  )
}

const FIELDS = [
  { key: 'id_order', label: 'OS' },
  { key: 'customer_name', label: 'Cliente' },
  { key: 'model_name', label: 'Modelo' },
  { key: 'plate_number', label: 'Placa' },
  { key: 'status', label: 'Status', render: val => <StatusBadge value={val} /> },
]

function toDatetimeLocal(value) {
  if (!value) return ''
  return String(value).replace(' ', 'T').slice(0, 16)
}

function nowLocalISO() {
  const d = serverNow()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Inline line editors (products / services) ────────────────────
// Each section is a list of editable lines plus one blank line at the end.
// A line is committed (saved to the API for existing orders, kept locally for a
// new OS) when focus leaves it — see ProductLineRow / ServiceLineRow.
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const toNum = v => (v !== '' && v != null ? Number(v) : null)
const norm = v => (v == null ? '' : String(v))
const fmtPrice = v => (v != null && v !== '' ? Number(v).toFixed(2) : '')
const priceKey = v => (v == null || v === '' ? '' : String(Number(v)))

// Unit price of a product line: the price saved on the OS line (SERVICE_ORDER_PRODUCTS.SALES_PRICE),
// falling back to the stock price for lines that never had one.
function lineUnitPrice(p, inv) {
  const v = p.sales_price != null && p.sales_price !== '' ? p.sales_price : inv?.sales_price
  return v != null && v !== '' ? Number(v) : null
}

// Text input with the dd/mm/aaaa hh:mm mask plus a calendar button that opens the native date/time picker.
function DateTimeField({ name, display, onTextChange, value, onPick }) {
  const pickerRef = useRef(null)
  return (
    <div className="date-picker-wrapper">
      <input type="text" name={name} value={display} onChange={onTextChange} placeholder="dd/mm/aaaa hh:mm" maxLength={16} />
      <input
        type="datetime-local"
        ref={pickerRef}
        className="hidden-date-picker"
        tabIndex={-1}
        value={value || ''}
        onChange={e => onPick(e.target.value)}
      />
      <button type="button" className="btn-calendar" title="Escolher data e hora"
        onClick={() => pickerRef.current?.showPicker?.()}>📅</button>
    </div>
  )
}

function inventoryLabel(i, makes) {
  const maker = i.id_make ? (makes.find(m => m.id_make === i.id_make)?.name ?? '') : ''
  const parts = [i.name, maker].filter(Boolean).join(' · ')
  const qty = i.current_quantity != null ? ` (Estoque: ${i.current_quantity})` : ''
  return parts + (i.code ? ` [${i.code}]` : '') + qty
}

function findInventoryByName(items, name) {
  const n = (name ?? '').trim().toLowerCase()
  return n ? items.find(i => (i.name ?? '').trim().toLowerCase() === n) ?? null : null
}

// Enter moves to the next field (and, after the last one, to the next line)
// instead of submitting the whole OS form.
function lineKeyDown(e) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const sel = 'input:not([disabled]):not([readonly]), select'
  const fields = [...e.currentTarget.querySelectorAll(sel)]
  const next = fields[fields.indexOf(e.target) + 1]
  if (next) { next.focus(); return }
  const nextInput = e.currentTarget.nextElementSibling?.querySelector(sel)
  if (nextInput) nextInput.focus()
  else e.target.blur()
}

// Tab on the last field of the last line adds a new blank line (focus then lands on it).
function lineTabAdd(e, isLast, onAddBlank) {
  if (e.key !== 'Tab' || e.shiftKey || !isLast || !onAddBlank) return
  const fields = [...e.currentTarget.querySelectorAll('input:not([disabled]):not([readonly]), select')]
  if (e.target === fields[fields.length - 1]) onAddBlank()
}

// Commit the line only when focus actually leaves it (not when moving between its fields).
function onLineBlur(e, commit) {
  if (e.currentTarget.contains(e.relatedTarget)) return
  commit()
}

function ProductNameInput({ value, onChange, onPick, items, makes }) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState({})
  const ref = useRef(null)
  const q = value.trim()
  const matches = (q ? items.filter(i => matchesSearchQuery(inventoryLabel(i, makes), q)) : items).slice(0, 15)

  function show() {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setStyle({ position: 'fixed', top: r.bottom + 2, left: r.left, width: Math.max(r.width, 340), zIndex: 9999 })
    setOpen(true)
  }

  return (
    <div className="autocomplete-wrapper">
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder="Digite o produto..."
        autoComplete="off"
        onChange={e => { onChange(e.target.value); show() }}
        onFocus={show}
        onBlur={() => setOpen(false)}
      />
      {open && matches.length > 0 && createPortal(
        <ul className="autocomplete-list" style={style}>
          {matches.map(i => (
            <li key={i.id_product} onMouseDown={e => { e.preventDefault(); setOpen(false); onPick(i) }}>
              <span className="autocomplete-name">{inventoryLabel(i, makes)}</span>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}

function ProductLineRow({ row, index, lineKey, inventoryItems, inventoryReady, productMakes, isTecnico, isLast, onAddBlank, onRemoveBlank, onBlankSaved, onCommit, onResolve, onDelete }) {
  const inv = row ? inventoryItems.find(i => i.id_product === Number(row.id_product)) : null
  const emptyVals = { id_product: '', name: '', quantity: '', cost_price: '', sales_price: '' }
  const baseVals = () => row
    ? { id_product: row.id_product ?? '', name: row.product_name ?? inv?.name ?? '', quantity: row.quantity ?? '', cost_price: fmtPrice(row.cost_price ?? inv?.cost_price), sales_price: fmtPrice(row.sales_price ?? inv?.sales_price) }
    : emptyVals
  const [vals, setVals] = useState(baseVals)
  const [error, setError] = useState(null)
  const busyRef = useRef(false)

  useEffect(() => { setVals(baseVals()) }, [row, inv?.name])

  // The unit price belongs to the line (saved in SERVICE_ORDER_PRODUCTS.SALES_PRICE); picking a
  // product pre-fills it with the stock price, and it can be changed freely.
  const matched = (vals.id_product !== '' && inventoryItems.find(i => i.id_product === Number(vals.id_product)))
    || findInventoryByName(inventoryItems, vals.name)
  const unitPrice = vals.sales_price
  const lineTotal = Number(unitPrice || 0) * Number(vals.quantity || 0)
  const isEmpty = !vals.name.trim() && vals.quantity === '' && vals.cost_price === '' && vals.sales_price === ''
  // until the stock list is loaded a saved line can't be matched to its product, so never treat it as edited
  const rowProductId = row?.id_product != null ? Number(row.id_product) : null
  const dirty = !inventoryReady ? false : row
    ? ((matched?.id_product ?? null) !== rowProductId
        || norm(vals.quantity) !== norm(row.quantity)
        || priceKey(vals.sales_price) !== priceKey(row.sales_price ?? inv?.sales_price)
        || priceKey(vals.cost_price) !== priceKey(row.cost_price ?? inv?.cost_price)
        || (!matched && vals.name.trim() !== norm(row.product_name)))
    : !isEmpty

  async function commit() {
    if (busyRef.current) return
    if (!dirty) { onResolve(lineKey); setError(null); return }
    busyRef.current = true
    const res = await onCommit(lineKey, row, { ...vals, id_product: matched?.id_product ?? '' })
    busyRef.current = false
    setError(res?.error ?? null)
    if (!res?.error && !row) onBlankSaved()
  }

  function remove() {
    onResolve(lineKey)
    if (row) onDelete(row)
    else onRemoveBlank()
  }

  return (
    <div className={`line-row${isTecnico ? ' no-price' : ' product-line'}`} onBlur={e => onLineBlur(e, commit)}
      onKeyDown={e => { lineKeyDown(e); lineTabAdd(e, isLast, onAddBlank) }}>
      <span className="line-index">{index}</span>
      <ProductNameInput
        value={vals.name}
        onChange={name => setVals(v => {
          const m = findInventoryByName(inventoryItems, name)
          return { ...v, name, id_product: m?.id_product ?? '', cost_price: m ? fmtPrice(m.cost_price) : (v.id_product !== '' ? '' : v.cost_price), sales_price: m ? fmtPrice(m.sales_price) : (v.id_product !== '' ? '' : v.sales_price) }
        })}
        onPick={i => setVals(v => ({ ...v, id_product: i.id_product, name: i.name ?? '', cost_price: fmtPrice(i.cost_price), sales_price: fmtPrice(i.sales_price) }))}
        items={inventoryItems}
        makes={productMakes}
      />
      <input
        type="number" min="0.001" step="any" value={vals.quantity}
        onChange={e => setVals(v => ({ ...v, quantity: e.target.value }))}
      />
      {!isTecnico && (
        <input
          type="number" min="0" step="0.01" value={vals.cost_price}
          title="Valor de custo desta OS"
          onChange={e => setVals(v => ({ ...v, cost_price: e.target.value }))}
        />
      )}
      {!isTecnico && (
        <input
          type="number" min="0" step="0.01" value={unitPrice}
          title="Valor unitário desta OS"
          onChange={e => setVals(v => ({ ...v, sales_price: e.target.value }))}
        />
      )}
      {!isTecnico && <input type="text" readOnly tabIndex={-1} value={lineTotal ? brl(lineTotal) : ''} />}
      <button type="button" className="line-delete" title="Excluir linha" tabIndex={-1}
        onMouseDown={e => e.preventDefault()} onClick={remove}>🗑</button>
      {vals.name.trim() && !matched && !error && (
        <div className="line-hint">Produto não encontrado no estoque — será cadastrado no estoque ao salvar a OS.</div>
      )}
      {row && inv?.current_quantity != null && !error && (
        <div className="line-hint">Estoque: {inv.current_quantity}</div>
      )}
      {error && <div className="line-error">{error}</div>}
    </div>
  )
}

const SVC_STATUS_COLORS = {
  0: { bg: '#374151', color: '#9ca3af' },
  1: { bg: '#555965', color: '#e0e0e0' },
  2: { bg: '#b89a00', color: '#1a1a1a' },
  3: { bg: '#3a6ea8', color: '#fff'    },
  4: { bg: '#a0611a', color: '#fff'    },
  5: { bg: '#27863f', color: '#fff'    },
  6: { bg: '#7f1d1d', color: '#fca5a5' },
}
const SVC_STATUS_OPTS = [
  { value: 0, label: 'Orçamento'        },
  { value: 1, label: 'Aberta'           },
  { value: 2, label: 'Andamento'        },
  { value: 3, label: 'Aguardando Peças' },
  { value: 4, label: 'Em Teste'         },
  { value: 5, label: 'Concluído'        },
  { value: 6, label: 'Não aprovado'     },
]

function ServiceLineRow({ row, index, lineKey, technicians, myTechId, isTecnico, isLast, onAddBlank, onRemoveBlank, onBlankSaved, onCommit, onResolve, onDelete }) {
  const emptyVals = { description: '', id_technician: isTecnico ? (myTechId ?? '') : '', hours_quantity: '', unit_value: '', total_value: '', status: '' }
  const baseVals = () => row
    ? {
        description: row.description ?? '',
        id_technician: row.id_technician ?? '',
        hours_quantity: row.hours_quantity ?? '',
        unit_value: row.unit_value ?? '',
        total_value: row.total_value ?? '',
        status: row.status ?? '',
      }
    : emptyVals
  const [vals, setVals] = useState(baseVals)
  const [error, setError] = useState(null)
  const busyRef = useRef(false)

  useEffect(() => { setVals(baseVals()) }, [row])
  // the technician list loads after mount — fill the technician's own id once known
  useEffect(() => {
    if (!row && isTecnico && myTechId != null) setVals(v => v.id_technician === '' ? { ...v, id_technician: myTechId } : v)
  }, [myTechId])

  const fields = ['description', 'id_technician', 'hours_quantity', 'unit_value', 'total_value', 'status']
  const isEmpty = !vals.description.trim() && vals.hours_quantity === '' && vals.unit_value === '' && vals.total_value === ''
  const dirty = row ? fields.some(k => norm(vals[k]) !== norm(row[k])) : !isEmpty

  function setField(name, value) {
    setVals(prev => {
      const next = { ...prev, [name]: value }
      if ((name === 'hours_quantity' || name === 'unit_value') && next.hours_quantity !== '' && next.unit_value !== '') {
        next.total_value = (Number(next.hours_quantity) * Number(next.unit_value)).toFixed(2)
      }
      return next
    })
  }

  async function commit() {
    if (busyRef.current) return
    if (!dirty) { onResolve(lineKey); setError(null); return }
    busyRef.current = true
    const res = await onCommit(lineKey, row, vals)
    busyRef.current = false
    setError(res?.error ?? null)
    if (!res?.error && !row) onBlankSaved()
  }

  function remove() {
    onResolve(lineKey)
    if (row) onDelete(row)
    else onRemoveBlank()
  }

  const sc = SVC_STATUS_COLORS[vals.status] ?? {}
  return (
    <div className={`line-row service-line${isTecnico ? ' no-price' : ''}`} onBlur={e => onLineBlur(e, commit)}
      onKeyDown={e => { lineKeyDown(e); lineTabAdd(e, isLast, onAddBlank) }}>
      <span className="line-index">{index}</span>
      <input type="text" value={vals.description} placeholder="Digite o serviço..."
        onChange={e => setField('description', e.target.value)} />
      {isTecnico ? (
        <input type="text" readOnly tabIndex={-1} value={technicians.find(t => t.id_technician === Number(myTechId))?.name ?? ''} />
      ) : (
        <SelectAutocomplete
          items={technicians}
          value={vals.id_technician}
          onChange={val => setField('id_technician', val)}
          getId={t => t.id_technician}
          getLabel={t => t.name ?? ''}
          placeholder="Técnico"
        />
      )}
      <input type="number" min="0" step="any" value={vals.hours_quantity}
        onChange={e => setField('hours_quantity', e.target.value)} />
      {!isTecnico && <input type="number" min="0" step="0.01" value={vals.unit_value}
        onChange={e => setField('unit_value', e.target.value)} />}
      {!isTecnico && <input type="number" min="0" step="0.01" value={vals.total_value}
        onChange={e => setField('total_value', e.target.value)} />}
      <select
        value={vals.status}
        onChange={e => setField('status', e.target.value !== '' ? Number(e.target.value) : '')}
        style={{ background: sc.bg ?? '#2a2a2a', color: sc.color ?? '#ccc', fontWeight: 600 }}
      >
        <option value="">— Status —</option>
        {SVC_STATUS_OPTS.map(opt => (
          <option key={opt.value} value={opt.value}
            style={{ background: SVC_STATUS_COLORS[opt.value]?.bg ?? '#1a1a1a', color: SVC_STATUS_COLORS[opt.value]?.color ?? '#ccc' }}>
            {opt.label}
          </option>
        ))}
      </select>
      <button type="button" className="line-delete" title="Excluir linha" tabIndex={-1}
        onMouseDown={e => e.preventDefault()} onClick={remove}>🗑</button>
      {error && <div className="line-error">{error}</div>}
    </div>
  )
}

export function ServiceOrderForm({ initialData, onSaved, onCancel }) {
  // isEdit is true only when editing an existing order (has a real id_order).
  // When arriving from "Abrir OS" the initialData only carries id_customer / id_customer_model.
  const orderId = initialData?.id_order ?? null
  const isEdit = !!orderId
  const isTecnico = getProfile() === 3
  const myUserId = getUserId()
  const [form, setForm] = useState({
    service_type: initialData?.service_type ?? '',
    id_customer_model: initialData?.id_customer_model ?? '',
    date_time_in: toDatetimeLocal(initialData?.date_time_in) || nowLocalISO(),
    estimated_delivery_at: toDatetimeLocal(initialData?.estimated_delivery_at),
    id_customer: initialData?.id_customer ?? '',
    id_technician: initialData?.id_technician ?? '',
    customer_notes: initialData?.customer_notes ?? '',
    internal_notes: initialData?.internal_notes ?? '',
    remarks: initialData?.remarks ?? '',
    diagnosis_notes: initialData?.diagnosis_notes ?? '',
    odometer_reading: initialData?.odometer_reading ?? '',
    discount: initialData?.discount ?? '',
    status: initialData?.status ?? 0,
  })
  const [dateTimeInDisplay, setDateTimeInDisplay] = useState(() => {
    const raw = toDatetimeLocal(initialData?.date_time_in) || nowLocalISO()
    if (!raw) return ''
    const [datePart, timePart] = raw.replace('T', ' ').split(' ')
    const [year, month, day] = datePart.split('-')
    return `${day}/${month}/${year}${timePart ? ' ' + timePart.slice(0, 5) : ''}`
  })
  const [estimatedDeliveryDisplay, setEstimatedDeliveryDisplay] = useState(() => {
    const raw = toDatetimeLocal(initialData?.estimated_delivery_at)
    if (!raw) return ''
    const [datePart, timePart] = raw.replace('T', ' ').split(' ')
    const [year, month, day] = datePart.split('-')
    return `${day}/${month}/${year}${timePart ? ' ' + timePart.slice(0, 5) : ''}`
  })
  const [customers, setCustomers] = useState([])
  const [allModels, setAllModels] = useState([])
  const [technicians, setTechnicians] = useState([])
  const myTechId = isTecnico && myUserId ? (technicians.find(t => t.id_user === myUserId)?.id_technician ?? null) : null
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCarOpen, setNewCarOpen] = useState(false)
  const [newTechnicianOpen, setNewTechnicianOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [discountFocused, setDiscountFocused] = useState(false)

  // Chassi (VIN) lives on CUSTOMER_MODEL: edited here, written to the selected vehicle on save.
  // null = untouched (shows the vehicle's current VIN).
  const [vinEdit, setVinEdit] = useState(null)
  useEffect(() => { setVinEdit(null) }, [form.id_customer_model])

  // ── Services / Products panels (inline lines) ────────────────
  const [orderServices, setOrderServices] = useState([])
  const orderServicesRef = useRef(orderServices)
  const [inventoryItems, setInventoryItems] = useState([])
  const [inventoryReady, setInventoryReady] = useState(false)
  const inventoryRef = useRef(inventoryItems)
  inventoryRef.current = inventoryItems
  const [productMakes, setProductMakes] = useState([])
  const [orderProducts, setOrderProducts] = useState([])
  const orderProductsRef = useRef(orderProducts)
  const [productError, setProductError] = useState(null)

  // Blank (not yet filled) lines per section: one by default, more via Tab, removable with the trash.
  const blankSeq = useRef(1)
  const [blankProducts, setBlankProducts] = useState([1])
  const [blankServices, setBlankServices] = useState([1])
  const addBlank = setter => setter(prev => [...prev, ++blankSeq.current])
  const removeBlank = (setter, id) => setter(prev => prev.filter(x => x !== id))
  const blankSaved = (setter, id) => setter(prev => {
    const rest = prev.filter(x => x !== id)
    return rest.length ? rest : [++blankSeq.current]
  })

  // Lines are committed asynchronously when focus leaves them. Saving the OS waits for any
  // commit still in flight, and refuses to save while a line is rejected (failedLines).
  const pendingCommits = useRef(new Set())
  const failedLines = useRef(new Set())

  // The refs mirror the state synchronously so commits and saveOrder never read a stale list.
  function updateOrderProducts(fn) {
    orderProductsRef.current = fn(orderProductsRef.current)
    setOrderProducts(orderProductsRef.current)
  }
  function updateOrderServices(fn) {
    orderServicesRef.current = fn(orderServicesRef.current)
    setOrderServices(orderServicesRef.current)
  }
  function trackCommit(promise) {
    const done = () => pendingCommits.current.delete(promise)
    pendingCommits.current.add(promise)
    promise.then(done, done)
    return promise
  }
  async function waitForPendingCommits() {
    while (pendingCommits.current.size) await Promise.allSettled([...pendingCommits.current])
  }
  function resolveLine(key) { failedLines.current.delete(key) }

  // ── Payments panel ────────────────────────────────────────────
  const emptyPaymentForm = { id_payment_method: '', due_date: '', payment_date: '', value: '', installments: 1 }

  function isCreditCard(description) {
    if (!description) return false
    const d = description.toUpperCase()
    return d.includes('CART') || d.includes('CREDITO') || d.includes('CRÉDITO')
  }

  function addMonths(isoDate, months) {
    if (!isoDate) {
      const d = serverNow()
      d.setMonth(d.getMonth() + months)
      return localISODate(d)
    }
    const d = new Date(isoDate + 'T12:00:00')
    d.setMonth(d.getMonth() + months)
    return d.toISOString().slice(0, 10)
  }
  const [paymentMethods, setPaymentMethods] = useState([])
  const [orderPayments, setOrderPayments] = useState([])
  const [editingPayment, setEditingPayment] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState(null)
  const [dueDateDisplay, setDueDateDisplay] = useState('')
  const [paymentDateDisplay, setPaymentDateDisplay] = useState('')
  const dueDatePickerRef = useRef(null)
  const paymentDatePickerRef = useRef(null)

  useEffect(() => {
    fetchAllCustomer().then(data => setCustomers((data ?? []).sort((a, b) => customerDisplayName(a).localeCompare(customerDisplayName(b), 'pt-BR', { sensitivity: 'base' })))).catch(() => {})
    fetchAllCustomerModel().then(models => {
      setAllModels(models ?? [])
      // When arriving from "Abrir OS", derive id_customer from id_customer_model
      // in case the API didn't include it (or the server hasn't restarted yet).
      if (initialData?.id_customer_model && !initialData?.id_customer) {
        const m = (models ?? []).find(m => String(m.id_customer_model) === String(initialData.id_customer_model))
        if (m?.id_customer) setForm(prev => ({ ...prev, id_customer: m.id_customer }))
      }
    }).catch(() => {})
    fetchAllTechnician().then(data => setTechnicians(data ?? [])).catch(() => {})
    fetchAllInventory()
      .then(data => setInventoryItems((data ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR', { sensitivity: 'base' }))))
      .then(() => setInventoryReady(true))
      .catch(() => {})
    fetchAllVehicleMake().then(data => setProductMakes(data ?? [])).catch(() => {})
    fetchAllPaymentMethod().then(data => setPaymentMethods(data ?? [])).catch(() => {})
    if (isEdit) {
      fetchAllServices()
        .then(all => updateOrderServices(() => all.filter(s => s.id_order === initialData.id_order)))
        .catch(() => {})
      fetchServiceOrderProductsByOrder(initialData.id_order)
        .then(data => updateOrderProducts(() => data ?? []))
        .catch(err => setProductError('Erro ao carregar produtos: ' + err.message))
      fetchPaymentsByOrder(initialData.id_order)
        .then(data => setOrderPayments(data ?? []))
        .catch(err => setPaymentError('Erro ao carregar pagamentos: ' + err.message))
    }
  }, [])

  // ── Inline lines: commit / delete ─────────────────────────────
  // Called when focus leaves a line. Returns { error } when the line was rejected
  // (it stays on screen with the message), otherwise {}.
  function commitServiceLine(lineKey, row, vals) {
    return trackCommit((async () => {
      if (!vals.description.trim()) {
        failedLines.current.add(lineKey)
        return { error: 'Informe a descrição do serviço.' }
      }
      const idTech = isTecnico ? myTechId : vals.id_technician
      const techName = technicians.find(t => t.id_technician === Number(idTech))?.name ?? null
      const payload = {
        code: row?.code || null,
        description: vals.description.trim(),
        hours_quantity: toNum(vals.hours_quantity),
        unit_value: toNum(vals.unit_value),
        total_value: toNum(vals.total_value),
        id_order: isEdit ? Number(orderId) : null,
        id_technician: toNum(idTech),
        status: toNum(vals.status),
      }
      try {
        if (row?.id_service) {
          await updateServices(row.id_service, payload)
          updateOrderServices(prev => prev.map(s => s.id_service === row.id_service
            ? { ...s, ...payload, id_service: s.id_service, technician_name: techName }
            : s))
        } else if (isEdit) {
          const created = await createServices(payload)
          updateOrderServices(prev => [...prev, { ...created, technician_name: techName }])
        } else {
          const local = {
            code: '', description: payload.description, hours_quantity: vals.hours_quantity,
            unit_value: vals.unit_value, total_value: vals.total_value, id_technician: idTech ?? '',
            status: vals.status, technician_name: techName, _tempId: row?._tempId ?? Date.now(),
          }
          updateOrderServices(prev => row?._tempId ? prev.map(s => s._tempId === row._tempId ? local : s) : [...prev, local])
        }
        failedLines.current.delete(lineKey)
        return {}
      } catch (err) {
        failedLines.current.add(lineKey)
        return { error: err.message }
      }
    })())
  }

  async function handleServiceDelete(s) {
    if (!window.confirm('Excluir serviço?')) return
    if (s.id_service) {
      try {
        await deleteServices(s.id_service)
        updateOrderServices(prev => prev.filter(x => x.id_service !== s.id_service))
      } catch (err) {
        alert('Erro ao excluir: ' + err.message)
      }
    } else {
      updateOrderServices(prev => prev.filter(x => x._tempId !== s._tempId))
    }
  }

  // A product typed on a line that isn't in stock stays on the line (id_product null) and
  // is registered in stock when the OS is saved — see registerPendingProducts.
  function commitProductLine(lineKey, row, vals) {
    return trackCommit((async () => {
      const fail = error => { failedLines.current.add(lineKey); return { error } }
      const name = vals.name.trim()
      if (!name) return fail('Informe o produto.')
      if (!inventoryReady) return fail('Aguarde o carregamento do estoque e tente novamente.')
      const qty = Number(vals.quantity)
      if (!(qty > 0)) return fail('Informe a quantidade.')
      try {
        let inv = vals.id_product !== '' ? inventoryRef.current.find(i => i.id_product === Number(vals.id_product)) : null
        inv = inv ?? findInventoryByName(inventoryRef.current, name)
        const typedPrice = vals.sales_price !== '' && vals.sales_price != null ? Number(vals.sales_price) : null
        const typedCost = vals.cost_price !== '' && vals.cost_price != null ? Number(vals.cost_price) : null

        if (!inv) {
          const price = typedPrice
          const local = { id_product: null, product_name: name, quantity: qty, cost_price: typedCost, sales_price: price, _tempId: row?._tempId ?? Date.now() }
          if (row?.id_service_order_product) {
            // a saved line switched to a product that isn't in stock: drop it, the new line is created on save
            await deleteServiceOrderProduct(row.id_service_order_product)
            updateOrderProducts(prev => [...prev.filter(p => p.id_service_order_product !== row.id_service_order_product), local])
          } else {
            updateOrderProducts(prev => row?._tempId ? prev.map(p => p._tempId === row._tempId ? local : p) : [...prev, local])
          }
          failedLines.current.delete(lineKey)
          return {}
        }

        const changedProduct = !row || Number(row.id_product) !== inv.id_product || Number(row.quantity) !== qty
        if (changedProduct && inv.current_quantity != null && qty > inv.current_quantity) {
          const ok = window.confirm(
            `Estoque atual de "${inv.name}": ${inv.current_quantity}. Essa quantidade deixará o estoque negativo. Deseja continuar?`
          )
          if (!ok) return fail('Quantidade acima do estoque — confirme ou ajuste a quantidade.')
        }
        const payload = {
          id_order: isEdit ? Number(orderId) : null,
          id_product: inv.id_product,
          quantity: qty,
          cost_price: typedCost ?? (inv.cost_price != null ? Number(inv.cost_price) : null),
          sales_price: typedPrice ?? (inv.sales_price != null ? Number(inv.sales_price) : null),
        }
        if (row?.id_service_order_product) {
          const updated = await updateServiceOrderProduct(row.id_service_order_product, payload)
          updateOrderProducts(prev => prev.map(p =>
            p.id_service_order_product === row.id_service_order_product ? { ...updated, product_name: inv.name } : p))
        } else if (isEdit) {
          const created = await createServiceOrderProduct(payload)
          const saved = { ...created, product_name: inv.name }
          updateOrderProducts(prev => row?._tempId ? prev.map(p => p._tempId === row._tempId ? saved : p) : [...prev, saved])
        } else {
          const local = { id_product: inv.id_product, quantity: qty, cost_price: payload.cost_price, sales_price: payload.sales_price, product_name: inv.name, _tempId: row?._tempId ?? Date.now() }
          updateOrderProducts(prev => row?._tempId ? prev.map(p => p._tempId === row._tempId ? local : p) : [...prev, local])
        }
        failedLines.current.delete(lineKey)
        return {}
      } catch (err) {
        return fail(err.message)
      }
    })())
  }

  // On OS save: register in stock every product typed on a line that wasn't there. In an
  // existing OS the line is also created now (it needs the new id_product); in a new OS the
  // id just gets filled in and the lines are created together with the order.
  async function registerPendingProducts() {
    for (const row of orderProductsRef.current.filter(p => p.id_product == null && p._tempId)) {
      let inv = findInventoryByName(inventoryRef.current, row.product_name)
      if (!inv) {
        inv = await createInventory({ name: row.product_name, cost_price: row.cost_price ?? null, sales_price: row.sales_price ?? null, current_quantity: 0, product_size: '' })
        inventoryRef.current = [...inventoryRef.current, inv]
        setInventoryItems(inventoryRef.current)
      }
      if (isEdit) {
        const created = await createServiceOrderProduct({
          id_order: Number(orderId),
          id_product: inv.id_product,
          quantity: Number(row.quantity),
          cost_price: row.cost_price ?? (inv.cost_price != null ? Number(inv.cost_price) : null),
          sales_price: row.sales_price ?? (inv.sales_price != null ? Number(inv.sales_price) : null),
        })
        updateOrderProducts(prev => prev.map(p => p._tempId === row._tempId ? { ...created, product_name: inv.name } : p))
      } else {
        updateOrderProducts(prev => prev.map(p => p._tempId === row._tempId ? { ...p, id_product: inv.id_product, product_name: inv.name } : p))
      }
    }
  }

  async function handleProductDelete(p) {
    if (!window.confirm('Excluir produto da OS?')) return
    if (p.id_service_order_product) {
      try {
        await deleteServiceOrderProduct(p.id_service_order_product)
        updateOrderProducts(prev => prev.filter(x => x.id_service_order_product !== p.id_service_order_product))
      } catch (err) {
        alert('Erro ao excluir: ' + err.message)
      }
    } else {
      updateOrderProducts(prev => prev.filter(x => x._tempId !== p._tempId))
    }
  }

  function isoToBR(iso) {
    if (!iso) return ''
    const parts = iso.slice(0, 10).split('-')
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ''
  }

  function brToISO(br) {
    const parts = br.split('/')
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4)
      return `${parts[2]}-${parts[1]}-${parts[0]}`
    return ''
  }

  function maskDate(val) {
    const digits = val.replace(/\D/g, '').slice(0, 8)
    let d = digits
    if (digits.length > 2) d = digits.slice(0, 2) + '/' + digits.slice(2)
    if (digits.length > 4) d = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
    return d
  }

  function openNewPayment() {
    setPaymentForm(emptyPaymentForm)
    setDueDateDisplay('')
    setPaymentDateDisplay('')
    setEditingPayment({})
    setPaymentError(null)
  }

  function openEditPayment(p) {
    setPaymentForm({
      id_payment_method: p.id_payment_method ?? '',
      due_date: p.due_date ? p.due_date.slice(0, 10) : '',
      payment_date: p.payment_date ? p.payment_date.slice(0, 10) : '',
      value: p.value ?? '',
    })
    setDueDateDisplay(isoToBR(p.due_date))
    setPaymentDateDisplay(isoToBR(p.payment_date))
    setEditingPayment(p)
    setPaymentError(null)
  }

  function handlePaymentChange(e) {
    const { name, value } = e.target
    setPaymentForm(prev => ({ ...prev, [name]: value }))
  }

  function buildPaymentPayload(idOrder) {
    return {
      id_order: idOrder ? Number(idOrder) : null,
      id_payment_method: paymentForm.id_payment_method !== '' ? Number(paymentForm.id_payment_method) : null,
      due_date: paymentForm.due_date || null,
      payment_date: paymentForm.payment_date || null,
      value: paymentForm.value !== '' ? Number(paymentForm.value) : null,
    }
  }

  async function handlePaymentSave() {
    if (!paymentForm.id_payment_method) {
      setPaymentError('Selecione a forma de pagamento.')
      return
    }
    const method = paymentMethods.find(m => m.id_payment_method === Number(paymentForm.id_payment_method))
    const installments = isCreditCard(method?.description) ? (Number(paymentForm.installments) || 1) : 1
    const isNewPayment = !editingPayment.id_payment

    setPaymentSaving(true)
    setPaymentError(null)
    try {
      if (!isNewPayment) {
        // Editing an existing saved payment — always single row
        const payload = buildPaymentPayload(initialData.id_order)
        const updated = await updatePayment(editingPayment.id_payment, payload)
        setOrderPayments(prev => prev.map(p =>
          p.id_payment === editingPayment.id_payment
            ? { ...updated, payment_method_description: method?.description ?? null }
            : p
        ))
      } else if (installments > 1) {
        // Multi-installment: determine base amount
        let baseValue
        if (paymentForm.value !== '' && paymentForm.value != null && Number(paymentForm.value) > 0) {
          baseValue = Number(paymentForm.value)
        } else {
          const totalServices = orderServices.reduce((acc, s) => acc + (s.total_value != null ? Number(s.total_value) : 0), 0)
          const totalProducts = orderProducts.reduce((acc, p) => {
            const inv = inventoryItems.find(i => i.id_product === Number(p.id_product))
            const price = lineUnitPrice(p, inv)
        return acc + (price != null ? price * Number(p.quantity || 0) : 0)
          }, 0)
          const total = totalServices + totalProducts
          const discount = Number(form.discount) || 0
          const finalAmount = total - discount
          const totalPago = orderPayments.reduce((acc, p) => acc + (p.payment_date ? Number(p.value || 0) : 0), 0)
          baseValue = finalAmount - totalPago
        }
        const installmentValue = Math.round((baseValue / installments) * 100) / 100

        for (let i = 0; i < installments; i++) {
          const dueDate = addMonths(paymentForm.due_date, i)
          const payload = {
            id_order: initialData?.id_order ? Number(initialData.id_order) : null,
            id_payment_method: Number(paymentForm.id_payment_method),
            due_date: dueDate,
            payment_date: paymentForm.payment_date || null,
            value: installmentValue,
          }
          if (isEdit) {
            const created = await createPayment(payload)
            setOrderPayments(prev => [...prev, { ...created, payment_method_description: method?.description ?? null }])
          } else {
            setOrderPayments(prev => [...prev, { ...payload, payment_method_description: method?.description ?? null, _tempId: Date.now() + i }])
          }
        }
      } else if (isEdit) {
        const created = await createPayment(buildPaymentPayload(initialData.id_order))
        setOrderPayments(prev => [...prev, { ...created, payment_method_description: method?.description ?? null }])
      } else {
        setOrderPayments(prev => [...prev, { ...paymentForm, payment_method_description: method?.description ?? null, _tempId: Date.now() }])
      }
      setEditingPayment(null)
    } catch (err) {
      setPaymentError(err.message)
    } finally {
      setPaymentSaving(false)
    }
  }

  async function handlePaymentDelete(p) {
    if (!window.confirm('Excluir pagamento?')) return
    if (p.id_payment) {
      try {
        await deletePayment(p.id_payment)
        setOrderPayments(prev => prev.filter(x => x.id_payment !== p.id_payment))
      } catch (err) {
        alert('Erro ao excluir: ' + err.message)
      }
    } else {
      setOrderPayments(prev => prev.filter(x => x._tempId !== p._tempId))
    }
  }

  function handleNewCustomerSaved(created) {
    setCustomers(prev => [...prev, created].sort((a, b) => customerDisplayName(a).localeCompare(customerDisplayName(b), 'pt-BR', { sensitivity: 'base' })))
    setForm(prev => ({ ...prev, id_customer: created.id_customer, id_customer_model: '' }))
    setNewCustomerOpen(false)
    fetchAllCustomerModel().then(data => setAllModels(data ?? [])).catch(() => {})
  }

  async function handleNewCarSaved(created) {
    try {
      const fresh = await fetchAllCustomerModel()
      setAllModels(fresh ?? [])
    } catch {}
    setForm(prev => ({ ...prev, id_customer_model: created.id_customer_model }))
    setNewCarOpen(false)
  }

  async function handleNewTechnicianSaved(created) {
    try {
      const fresh = await fetchAllTechnician()
      setTechnicians(fresh ?? [])
    } catch {}
    setForm(prev => ({ ...prev, id_technician: created.id_technician }))
    setNewTechnicianOpen(false)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // value comes from the native picker as yyyy-mm-ddThh:mm
  function pickDateTime(field, setDisplay, value) {
    if (!value) return
    setForm(prev => ({ ...prev, [field]: value }))
    const [date, time] = value.split('T')
    const [y, m, d] = date.split('-')
    setDisplay(`${d}/${m}/${y} ${(time ?? '00:00').slice(0, 5)}`)
  }

  function handleDateTimeInChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
    let display = ''
    if (digits.length <= 2) {
      display = digits
    } else if (digits.length <= 4) {
      display = digits.slice(0, 2) + '/' + digits.slice(2)
    } else if (digits.length <= 8) {
      display = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
    } else if (digits.length <= 10) {
      display = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8) + ' ' + digits.slice(8)
    } else {
      display = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8) + ' ' + digits.slice(8, 10) + ':' + digits.slice(10)
    }
    setDateTimeInDisplay(display)
    if (digits.length === 12) {
      const day = digits.slice(0, 2), month = digits.slice(2, 4), year = digits.slice(4, 8)
      const hh = digits.slice(8, 10), mm = digits.slice(10, 12)
      setForm(prev => ({ ...prev, date_time_in: `${year}-${month}-${day}T${hh}:${mm}` }))
    } else if (digits.length === 8) {
      // Data completa sem hora: o display já parece completo ("05/03/2023"), então
      // descartar o valor salvaria date_time_in vazio sem aviso. Assume 00:00.
      const day = digits.slice(0, 2), month = digits.slice(2, 4), year = digits.slice(4, 8)
      setForm(prev => ({ ...prev, date_time_in: `${year}-${month}-${day}T00:00` }))
    } else {
      setForm(prev => ({ ...prev, date_time_in: '' }))
    }
  }

  function handleEstimatedDeliveryChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
    let display = ''
    if (digits.length <= 2) {
      display = digits
    } else if (digits.length <= 4) {
      display = digits.slice(0, 2) + '/' + digits.slice(2)
    } else if (digits.length <= 8) {
      display = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
    } else if (digits.length <= 10) {
      display = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8) + ' ' + digits.slice(8)
    } else {
      display = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8) + ' ' + digits.slice(8, 10) + ':' + digits.slice(10)
    }
    setEstimatedDeliveryDisplay(display)
    if (digits.length === 12) {
      const day = digits.slice(0, 2), month = digits.slice(2, 4), year = digits.slice(4, 8)
      const hh = digits.slice(8, 10), mm = digits.slice(10, 12)
      setForm(prev => ({ ...prev, estimated_delivery_at: `${year}-${month}-${day}T${hh}:${mm}` }))
    } else if (digits.length === 8) {
      const day = digits.slice(0, 2), month = digits.slice(2, 4), year = digits.slice(4, 8)
      setForm(prev => ({ ...prev, estimated_delivery_at: `${year}-${month}-${day}T00:00` }))
    } else {
      setForm(prev => ({ ...prev, estimated_delivery_at: '' }))
    }
  }

  async function saveOrder(overrideStatus) {
    setSaving(true)
    setError(null)
    try {
      // Lines commit when focus leaves them: wait for any commit still running, and
      // don't save the OS while a product/service line is rejected (it would be lost).
      await waitForPendingCommits()
      if (failedLines.current.size > 0) {
        setError('Há produtos ou serviços com pendência (veja a mensagem na linha). Corrija ou exclua a linha antes de salvar.')
        setSaving(false)
        return
      }
      await registerPendingProducts()
      const pendingServices = orderServicesRef.current
      const pendingProducts = orderProductsRef.current

      // Persist an edited chassi on the vehicle (CUSTOMER_MODEL.VIN) before saving the order.
      if (form.id_customer_model !== '' && vinEdit !== null) {
        const model = allModels.find(m => String(m.id_customer_model) === String(form.id_customer_model))
        const newVin = vinEdit.trim()
        if (model && (model.vin ?? '') !== newVin) {
          await updateCustomerModel(model.id_customer_model, { ...model, vin: newVin || null })
          setAllModels(prev => prev.map(m => m.id_customer_model === model.id_customer_model ? { ...m, vin: newVin || null } : m))
        }
      }

      const fmtDatetime = v => v ? v.replace('T', ' ') + (v.length === 16 ? ':00' : '') : null
      const totalServices = pendingServices.reduce((acc, s) => acc + (s.total_value != null ? Number(s.total_value) : 0), 0)
      const totalProducts = pendingProducts.reduce((acc, p) => {
        const inv = inventoryRef.current.find(i => i.id_product === Number(p.id_product))
        const price = lineUnitPrice(p, inv)
        return acc + (price != null ? price * Number(p.quantity || 0) : 0)
      }, 0)
      const totalAmount = totalServices + totalProducts
      const discount = Number(form.discount) || 0
      const resolvedStatus = overrideStatus ?? (form.status !== '' ? Number(form.status) : null)
      const payload = {
        ...form,
        service_type: form.service_type !== '' ? Number(form.service_type) : null,
        id_customer: form.id_customer !== '' ? Number(form.id_customer) : null,
        id_customer_model: form.id_customer_model !== '' ? Number(form.id_customer_model) : null,
        id_technician: form.id_technician !== '' && form.id_technician != null ? Number(form.id_technician) : null,
        odometer_reading: form.odometer_reading !== '' ? Number(form.odometer_reading) : null,
        date_time_in: fmtDatetime(form.date_time_in),
        estimated_delivery_at: fmtDatetime(form.estimated_delivery_at),
        total_amount: totalAmount,
        discount: discount,
        final_amount: totalAmount - discount,
        status: resolvedStatus,
      }
      if (isEdit) {
        await updateServiceOrder(orderId, payload)
      } else {
        const created = await createServiceOrder(payload)
        for (const s of pendingServices) {
          await createServices({
            code: s.code || null,
            description: s.description || null,
            hours_quantity: s.hours_quantity !== '' && s.hours_quantity != null ? Number(s.hours_quantity) : null,
            unit_value: s.unit_value !== '' && s.unit_value != null ? Number(s.unit_value) : null,
            total_value: s.total_value !== '' && s.total_value != null ? Number(s.total_value) : null,
            id_order: created.id_order,
            id_technician: s.id_technician !== '' && s.id_technician != null ? Number(s.id_technician) : null,
            status: s.status !== '' && s.status != null ? Number(s.status) : null,
          })
        }
        for (const p of pendingProducts) {
          await createServiceOrderProduct({
            id_order: created.id_order,
            id_product: p.id_product !== '' ? Number(p.id_product) : null,
            quantity: p.quantity !== '' ? Number(p.quantity) : null,
            cost_price: p.cost_price !== '' && p.cost_price != null ? Number(p.cost_price) : null,
            sales_price: p.sales_price !== '' && p.sales_price != null ? Number(p.sales_price) : null,
          })
        }
        for (const p of orderPayments) {
          await createPayment({
            id_order: created.id_order,
            id_payment_method: p.id_payment_method !== '' ? Number(p.id_payment_method) : null,
            installments_quantity: p.installments_quantity || null,
            due_date: p.due_date || null,
            payment_date: p.payment_date || null,
            value: p.value !== '' ? Number(p.value) : null,
          })
        }
      }
      // When closing the OS, set all services to Concluído too
      if (overrideStatus === 5 && isEdit) {
        for (const s of pendingServices) {
          if (s.id_service) {
            try {
              await updateServices(s.id_service, {
                code: s.code || null,
                description: s.description || null,
                hours_quantity: s.hours_quantity != null ? Number(s.hours_quantity) : null,
                unit_value: s.unit_value != null ? Number(s.unit_value) : null,
                total_value: s.total_value != null ? Number(s.total_value) : null,
                id_order: s.id_order != null ? Number(s.id_order) : null,
                id_technician: s.id_technician != null ? Number(s.id_technician) : null,
                status: 5,
              })
            } catch (_) { /* best-effort */ }
          }
        }
        updateOrderServices(prev => prev.map(s => ({ ...s, status: 5 })))
      }

      if (overrideStatus != null) setForm(prev => ({ ...prev, status: overrideStatus }))
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await saveOrder()
  }

  async function handleCloseOS() {
    if (!orderId) { setError('ID da OS não encontrado.'); return }
    await saveOrder(5)
  }

  const selectedStatus = STATUS_OPTIONS.find(o => o.value === Number(form.status))
  const statusStyle = selectedStatus ? (STATUS_STYLE[selectedStatus.value] ?? {}) : {}

  return (
    <form onSubmit={handleSubmit} className="crud-form">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 'none' }}>
          <label>Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            style={{
              ...statusStyle,
              fontWeight: 600,
              fontSize: '0.95rem',
              borderRadius: '8px',
              border: 'none',
              padding: '10px 14px',
              cursor: 'pointer',
              width: 'fit-content',
              minWidth: '180px',
              appearance: 'auto',
            }}
          >
            <option value="" style={{ background: '#1a1a1a', color: '#ccc', fontWeight: 400 }}>
              — Selecione o status —
            </option>
            {STATUS_OPTIONS.map(opt => {
              const s = STATUS_STYLE[opt.value] ?? {}
              return (
                <option
                  key={opt.value}
                  value={opt.value}
                  style={{ background: s.background, color: s.color, fontWeight: 600 }}
                >
                  {opt.label}
                </option>
              )
            })}
          </select>
        </div>
        <div className="form-actions" style={{ margin: 0, paddingBottom: '1px' }}>
          <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          {isEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={handleCloseOS}
              style={{
                padding: '8px 18px',
                background: form.status === 5 ? '#1a5c2a' : '#27863f',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: saving ? 'default' : 'pointer',
                fontSize: '0.95rem',
                opacity: form.status === 5 ? 0.7 : 1,
              }}
            >
              {saving ? 'Salvando...' : form.status === 5 ? '✓ OS Concluída' : '✓ Fechar OS'}
            </button>
          )}
          <button type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '220px' }}>
          <label>Cliente</label>
          <div className="autocomplete-with-add">
            <CustomerAutocomplete
              value={form.id_customer}
              onChange={val => {
                const customerCars = allModels.filter(m => m.id_customer === Number(val))
                const autoCar = customerCars.length === 1 ? customerCars[0] : null
                setForm(prev => ({
                  ...prev,
                  id_customer: val,
                  id_customer_model: autoCar ? autoCar.id_customer_model : '',
                }))
              }}
              customers={customers}
            />
            <button
              type="button"
              className="btn-add-inline"
              onClick={() => setNewCustomerOpen(true)}
              title="Cadastrar novo cliente"
            >+</button>
          </div>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: '220px' }}>
          <label>Carro/Placa</label>
          <div className="autocomplete-with-add">
            <CustomerModelAutocomplete
              value={form.id_customer_model}
              onChange={val => {
                if (!val) {
                  // Clearing the car also clears the customer
                  setForm(prev => ({ ...prev, id_customer_model: '', id_customer: '' }))
                  return
                }
                const car = allModels.find(m => m.id_customer_model === Number(val))
                setForm(prev => ({
                  ...prev,
                  id_customer_model: val,
                  id_customer: prev.id_customer || (car?.id_customer ?? ''),
                }))
              }}
              idCustomer={form.id_customer}
              allModels={allModels}
            />
            <button
              type="button"
              className="btn-add-inline"
              onClick={() => setNewCarOpen(true)}
              disabled={!form.id_customer}
              title={form.id_customer ? 'Cadastrar novo veículo' : 'Selecione um cliente antes de adicionar veículo à OS'}
            >+</button>
          </div>
        </div>
      </div>
      {newCustomerOpen && (
        <NewCustomerModal
          onSaved={handleNewCustomerSaved}
          onCancel={() => setNewCustomerOpen(false)}
        />
      )}
      {newCarOpen && (
        <NewCarModal
          idCustomer={form.id_customer}
          onSaved={handleNewCarSaved}
          onCancel={() => setNewCarOpen(false)}
        />
      )}
      {newTechnicianOpen && (
        <NewTechnicianModal
          onSaved={handleNewTechnicianSaved}
          onCancel={() => setNewTechnicianOpen(false)}
        />
      )}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Data/Hora de Entrada</label>
          <DateTimeField name="date_time_in" display={dateTimeInDisplay} onTextChange={handleDateTimeInChange}
            value={form.date_time_in} onPick={v => pickDateTime('date_time_in', setDateTimeInDisplay, v)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Data/Hora Estimada de Entrega</label>
          <DateTimeField name="estimated_delivery_at" display={estimatedDeliveryDisplay} onTextChange={handleEstimatedDeliveryChange}
            value={form.estimated_delivery_at} onPick={v => pickDateTime('estimated_delivery_at', setEstimatedDeliveryDisplay, v)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Técnico Responsável</label>
          <div className="autocomplete-with-add">
            <SelectAutocomplete
              items={technicians}
              value={form.id_technician}
              onChange={val => setForm(prev => ({ ...prev, id_technician: val }))}
              getId={t => t.id_technician}
              getLabel={t => t.name}
              placeholder="Digite o nome do técnico..."
            />
            <button
              type="button"
              className="btn-add-inline"
              onClick={() => setNewTechnicianOpen(true)}
              title="Cadastrar novo técnico"
            >+</button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Chassi (VIN)</label>
          <input
            type="text"
            value={vinEdit ?? allModels.find(m => String(m.id_customer_model) === String(form.id_customer_model))?.vin ?? initialData?.vin ?? ''}
            onChange={e => setVinEdit(e.target.value.toUpperCase().replace(/\s/g, ''))}
            maxLength={17}
            disabled={form.id_customer_model === ''}
            placeholder={form.id_customer_model === '' ? 'Selecione o veículo' : ''}
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Hodômetro (km)</label>
          <input
            type="text"
            inputMode="numeric"
            name="odometer_reading"
            value={form.odometer_reading !== '' && form.odometer_reading != null
              ? Number(form.odometer_reading).toLocaleString('pt-BR')
              : ''}
            onChange={e => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
              setForm(prev => ({ ...prev, odometer_reading: digits === '' ? '' : String(Number(digits)) }))
            }}
            placeholder="Leitura do hodômetro"
          />
        </div>
      </div>
      <div className="form-group">
        <label>Observações do Cliente</label>
        <textarea name="customer_notes" value={form.customer_notes} onChange={handleChange} rows={3} placeholder="Descreva o que o cliente relatou" />
      </div>
      <div className="form-group">
        <label>Observações Internas</label>
        <textarea name="internal_notes" value={form.internal_notes} onChange={handleChange} rows={3} placeholder="Digite aqui informações que NÃO devem ser apresentadas para o cliente (ex.: solicitar entrada, solicitar garantia, não fazer serviço etc.)" />
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Observações Gerais</label>
          <textarea name="remarks" value={form.remarks} onChange={handleChange} rows={3} maxLength={1200} placeholder="Digite aqui informações gerais (ex.: necessário fazer retífica. Cliente ciente)" />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Diagnóstico</label>
          <textarea name="diagnosis_notes" value={form.diagnosis_notes} onChange={handleChange} rows={3} placeholder="Digite aqui os problemas identificados, serviços a serem feitos" />
        </div>
      </div>
      {/* ── Services section ─────────────────────────────────── */}
      <div className="contact-section">
        <div className="contact-section-header">
          <span>Serviços</span>
        </div>

        <div className="line-table">
          <div className={`line-header service-line${isTecnico ? ' no-price' : ''}`}>
            <span></span>
            <span>Serviço</span>
            <span>Técnico</span>
            <span>Horas</span>
            {!isTecnico && <span>Valor unit.</span>}
            {!isTecnico && <span>Valor total</span>}
            <span>Status</span>
            <span></span>
          </div>
          {orderServices.map((s, idx) => {
            const key = s.id_service ?? s._tempId ?? idx
            return (
              <ServiceLineRow
                key={key}
                lineKey={`s:${key}`}
                row={s}
                index={idx + 1}
                technicians={technicians}
                myTechId={myTechId}
                isTecnico={isTecnico}
                isLast={idx === orderServices.length - 1 && blankServices.length === 0}
                onAddBlank={() => addBlank(setBlankServices)}
                onCommit={commitServiceLine}
                onResolve={resolveLine}
                onDelete={handleServiceDelete}
              />
            )
          })}
          {blankServices.map((id, bi) => (
            <ServiceLineRow
              key={`new-service-${id}`}
              lineKey={`s:new-${id}`}
              row={null}
              index={orderServices.length + bi + 1}
              technicians={technicians}
              myTechId={myTechId}
              isTecnico={isTecnico}
              isLast={bi === blankServices.length - 1}
              onAddBlank={() => addBlank(setBlankServices)}
              onRemoveBlank={() => removeBlank(setBlankServices, id)}
              onBlankSaved={() => blankSaved(setBlankServices, id)}
              onCommit={commitServiceLine}
              onResolve={resolveLine}
              onDelete={handleServiceDelete}
            />
          ))}
        </div>
        <button type="button" className="line-add" onClick={() => addBlank(setBlankServices)}>+ adicionar serviço</button>

        {orderServices.length > 0 && !isTecnico && (
          <div className="section-total">
            Total de Serviços: {orderServices
              .reduce((acc, s) => Number(s.status) === 6 ? acc : acc + (s.total_value != null ? Number(s.total_value) : 0), 0)
              .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        )}
      </div>

      {/* ── Products section ─────────────────────────────────── */}
      <div className="contact-section">
        <div className="contact-section-header">
          <span>Produtos</span>
        </div>

        {productError && <p className="error">{productError}</p>}

        <div className="line-table">
          <div className={`line-header${isTecnico ? ' no-price' : ' product-line'}`}>
            <span></span>
            <span>Produto</span>
            <span>Qtde.</span>
            {!isTecnico && <span>Valor custo</span>}
            {!isTecnico && <span>Valor unit.</span>}
            {!isTecnico && <span>Valor total</span>}
            <span></span>
          </div>
          {orderProducts.map((p, idx) => {
            const key = p.id_service_order_product ?? p._tempId ?? idx
            return (
              <ProductLineRow
                key={key}
                lineKey={`p:${key}`}
                row={p}
                index={idx + 1}
                inventoryItems={inventoryItems}
                inventoryReady={inventoryReady}
                productMakes={productMakes}
                isTecnico={isTecnico}
                isLast={idx === orderProducts.length - 1 && blankProducts.length === 0}
                onAddBlank={() => addBlank(setBlankProducts)}
                onCommit={commitProductLine}
                onResolve={resolveLine}
                onDelete={handleProductDelete}
              />
            )
          })}
          {blankProducts.map((id, bi) => (
            <ProductLineRow
              key={`new-product-${id}`}
              lineKey={`p:new-${id}`}
              row={null}
              index={orderProducts.length + bi + 1}
              inventoryItems={inventoryItems}
              inventoryReady={inventoryReady}
              productMakes={productMakes}
              isTecnico={isTecnico}
              isLast={bi === blankProducts.length - 1}
              onAddBlank={() => addBlank(setBlankProducts)}
              onRemoveBlank={() => removeBlank(setBlankProducts, id)}
              onBlankSaved={() => blankSaved(setBlankProducts, id)}
              onCommit={commitProductLine}
              onResolve={resolveLine}
              onDelete={handleProductDelete}
            />
          ))}
        </div>
        <button type="button" className="line-add" onClick={() => addBlank(setBlankProducts)}>+ adicionar produto</button>

        {orderProducts.length > 0 && !isTecnico && (
          <div className="section-total">
            Total de Produtos: {orderProducts
              .reduce((acc, p) => {
                const inv = inventoryItems.find(i => i.id_product === Number(p.id_product))
                const price = lineUnitPrice(p, inv)
                return acc + (price != null ? Number(price) * Number(p.quantity || 0) : 0)
              }, 0)
              .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        )}
      </div>

      {/* ── Payments section ─────────────────────────────────── */}
      {!isTecnico && <div className="contact-section">
        <div className="contact-section-header">
          <span>Pagamentos</span>
        </div>
        <div style={{ margin: '6px 0' }}>
          <button type="button" className="btn-add-contact" onClick={openNewPayment} disabled={editingPayment !== null}>
            + Adicionar
          </button>
        </div>

        {paymentError && editingPayment === null && <p className="error">{paymentError}</p>}

        {orderPayments.length > 0 && (
          <table className="services-table">
            <thead>
              <tr>
                <th></th>
                <th>Forma</th>
                <th>Vencimento</th>
                <th>Pagamento</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orderPayments.map((p, idx) => (
                <tr key={p.id_payment ?? p._tempId ?? idx}>
                  <td style={{ width: 1, padding: '6px 4px' }}><span className="line-index" style={{ display: 'block', width: 34 }}>{idx + 1}</span></td>
                  <td>{p.payment_method_description ?? ''}</td>
                  <td>{isoToBR(p.due_date)}</td>
                  <td>{isoToBR(p.payment_date)}</td>
                  <td>{p.value != null ? Number(p.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                  <td className="actions-col">
                    <button type="button" className="btn-edit" onClick={() => openEditPayment(p)}>Editar</button>
                    <button type="button" className="btn-delete" onClick={() => handlePaymentDelete(p)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {editingPayment !== null && (
          <div className="contact-editor">
            <div className="form-group">
              <label>Forma de Pagamento</label>
              <SelectAutocomplete
                items={paymentMethods}
                value={paymentForm.id_payment_method}
                onChange={val => setPaymentForm(prev => ({ ...prev, id_payment_method: val, installments: 1 }))}
                getId={m => m.id_payment_method}
                getLabel={m => m.description ?? ''}
                placeholder="Digite a forma de pagamento..."
              />
            </div>
            {(() => {
              const selectedMethod = paymentMethods.find(m => m.id_payment_method === Number(paymentForm.id_payment_method))
              const showInstallments = isCreditCard(selectedMethod?.description) && !editingPayment?.id_payment
              return showInstallments && (
                <div className="form-group">
                  <label>Parcelas</label>
                  <select
                    name="installments"
                    value={paymentForm.installments}
                    onChange={handlePaymentChange}
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                </div>
              )
            })()}
            <div className="form-group">
              <label>Vencimento</label>
              <div className="date-picker-wrapper">
                <input
                  type="text"
                  value={dueDateDisplay}
                  onChange={e => {
                    const display = maskDate(e.target.value)
                    setDueDateDisplay(display)
                    setPaymentForm(prev => ({ ...prev, due_date: brToISO(display) }))
                  }}
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                />
                <input
                  type="date"
                  ref={dueDatePickerRef}
                  className="hidden-date-picker"
                  onChange={e => {
                    setPaymentForm(prev => ({ ...prev, due_date: e.target.value }))
                    setDueDateDisplay(isoToBR(e.target.value))
                  }}
                />
                <button type="button" className="btn-calendar" onClick={() => dueDatePickerRef.current?.showPicker()}>📅</button>
              </div>
            </div>
            <div className="form-group">
              <label>Data de Pagamento</label>
              <div className="date-picker-wrapper">
                <input
                  type="text"
                  value={paymentDateDisplay}
                  onChange={e => {
                    const display = maskDate(e.target.value)
                    setPaymentDateDisplay(display)
                    setPaymentForm(prev => ({ ...prev, payment_date: brToISO(display) }))
                  }}
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                />
                <input
                  type="date"
                  ref={paymentDatePickerRef}
                  className="hidden-date-picker"
                  onChange={e => {
                    setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))
                    setPaymentDateDisplay(isoToBR(e.target.value))
                  }}
                />
                <button type="button" className="btn-calendar" onClick={() => paymentDatePickerRef.current?.showPicker()}>📅</button>
              </div>
            </div>
            <div className="form-group">
              <label>Valor</label>
              <input type="number" name="value" value={paymentForm.value} onChange={handlePaymentChange} min="0" step="0.01" />
            </div>
            {paymentError && <p className="error">{paymentError}</p>}
            <div className="form-actions">
              <button type="button" className="btn-novo" onClick={handlePaymentSave} disabled={paymentSaving}>
                {paymentSaving ? 'Salvando...' : 'Salvar pagamento'}
              </button>
              <button type="button" onClick={() => setEditingPayment(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>}

      {/* ── Total OS ─────────────────────────────────────────── */}
      {!isTecnico && (() => {
        const totalServices = orderServices.reduce((acc, s) => acc + (s.total_value != null ? Number(s.total_value) : 0), 0)
        const totalProducts = orderProducts.reduce((acc, p) => {
          const inv = inventoryItems.find(i => i.id_product === Number(p.id_product))
          const price = lineUnitPrice(p, inv)
        return acc + (price != null ? price * Number(p.quantity || 0) : 0)
        }, 0)
        const total = totalServices + totalProducts
        const discount = Number(form.discount) || 0
        const finalAmount = total - discount
        const totalPago = orderPayments.reduce((acc, p) => acc + (p.payment_date ? Number(p.value || 0) : 0), 0)
        const totalAberto = finalAmount - totalPago
        const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const roStyle = { width: '150px' }
        return (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 'none' }}>
              <label><strong>Total OS</strong></label>
              <input type="text" value={fmt(total)} readOnly style={roStyle} />
            </div>
            <div className="form-group" style={{ flex: 'none' }}>
              <label><strong>Desconto</strong></label>
              <input
                type="text"
                name="discount"
                style={{ width: '150px' }}
                value={discountFocused
                  ? (form.discount ?? '')
                  : (form.discount !== '' && form.discount != null
                      ? Number(form.discount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : '')}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
                  setForm(prev => ({ ...prev, discount: raw }))
                }}
                onFocus={() => setDiscountFocused(true)}
                onBlur={() => {
                  setDiscountFocused(false)
                  const num = parseFloat(String(form.discount).replace(',', '.'))
                  setForm(prev => ({ ...prev, discount: isNaN(num) ? '' : String(num) }))
                }}
              />
            </div>
            <div className="form-group" style={{ flex: 'none' }}>
              <label><strong>Valor Final</strong></label>
              <input type="text" value={fmt(finalAmount)} readOnly style={roStyle} />
            </div>
            <div className="form-group" style={{ flex: 'none' }}>
              <label><strong>Total Pago</strong></label>
              <input type="text" value={fmt(totalPago)} readOnly style={roStyle} />
            </div>
            <div className="form-group" style={{ flex: 'none' }}>
              <label><strong>Total Aberto</strong></label>
              <input type="text" value={fmt(totalAberto)} readOnly style={roStyle} />
            </div>
          </div>
        )
      })()}

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        {isEdit && (
          <button
            type="button"
            disabled={saving}
            onClick={handleCloseOS}
            style={{
              padding: '8px 18px',
              background: form.status === 5 ? '#1a5c2a' : '#27863f',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              fontSize: '0.95rem',
              opacity: form.status === 5 ? 0.7 : 1,
            }}
          >
            {saving ? 'Salvando...' : form.status === 5 ? '✓ OS Concluída' : '✓ Fechar OS'}
          </button>
        )}
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: ServiceOrderNewPage } = makeFormPages(ServiceOrderForm, 'Ordem de Serviço', '/service-orders')

export function ServiceOrderEditPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  useEffect(() => {
    if (!state?.item) navigate('/service-orders', { replace: true })
  }, [])
  if (!state?.item) return null
  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>Editar — Ordem de Serviço{state.item.id_order ? ` — OS #${state.item.id_order}` : ''}</h2>
      </div>
      <ServiceOrderForm
        initialData={state.item}
        onSaved={() => navigate('/service-orders')}
        onCancel={() => navigate('/service-orders')}
      />
    </div>
  )
}

function maskDate(val) {
  const d = val.replace(/\D/g, '').slice(0, 8)
  let r = d
  if (d.length > 2) r = d.slice(0, 2) + '/' + d.slice(2)
  if (d.length > 4) r = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4)
  return r
}

function brToISO(br) {
  const d = br.replace(/\D/g, '')
  if (d.length !== 8) return ''
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
}

function isoToBR(iso) {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const SO_FILTERS_KEY = '/service-orders:extra'

export default function ServiceOrderPage() {
  const todayBR = isoToBR(serverTodayISO())
  const initialExtraFilters = loadFilters(SO_FILTERS_KEY, { fromDisplay: todayBR, toDisplay: todayBR, statusFilter: null })
  const [fromDisplay, setFromDisplay] = useState(initialExtraFilters.fromDisplay)
  const [toDisplay,   setToDisplay]   = useState(initialExtraFilters.toDisplay)
  const [sendWpp, setSendWpp] = useState(false)
  const [wppOrder, setWppOrder] = useState(null)
  const [statusFilter, setStatusFilter] = useState(initialExtraFilters.statusFilter)
  const [myTechnicianId, setMyTechnicianId] = useState(null)
  const fromPickerRef = useRef(null)
  const toPickerRef   = useRef(null)
  const isTecnicoPage = getProfile() === 3
  const myUserIdPage  = getUserId()

  useEffect(() => {
    fetchTenantConfig().then(cfg => setSendWpp(cfg?.send_wpp === 1)).catch(() => {})
    if (isTecnicoPage && myUserIdPage) {
      fetchAllTechnician().then(techs => {
        const t = (techs ?? []).find(t => t.id_user === myUserIdPage)
        if (t) setMyTechnicianId(t.id_technician)
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    saveFilters(SO_FILTERS_KEY, { fromDisplay, toDisplay, statusFilter })
  }, [fromDisplay, toDisplay, statusFilter])

  const fromISO = brToISO(fromDisplay)
  const toISO   = brToISO(toDisplay)

  function additionalFilter(item) {
    const itemDate = item.date_time_in ? String(item.date_time_in).slice(0, 10) : ''
    if (fromISO && itemDate < fromISO) return false
    if (toISO   && itemDate > toISO)   return false
    if (statusFilter !== null && Number(item.status) !== statusFilter) return false
    return true
  }

  const hasDateFilter = fromISO || toISO

  return (
    <>
    {wppOrder && <WppSendModal order={wppOrder} onClose={() => setWppOrder(null)} />}
    <CrudPage
      title="⚙️ Ordens de Serviço"
      fetchAll={fetchAllServiceOrder}
      deleteItem={deleteServiceOrder}
      fields={FIELDS}
      FormComponent={ServiceOrderForm}
      createLabel="+ Nova OS"
      filterKeys={['id_order', 'customer_name', 'model_name', 'plate_number']}
      filterPlaceholder="OS, Cliente, Modelo ou Placa..."
      persistSearch={false}
      DetailComponent={ServiceOrderDetailFull}
      closeOnOverlayClick={false}
      basePath="/service-orders"
      pageSize={20}
      rowActions={sendWpp && !isTecnicoPage ? (item) => (
        <button
          className="btn-edit"
          style={{ background: '#25d366', color: '#fff', border: 'none' }}
          onClick={() => setWppOrder(item)}
          title="Enviar OS pelo WhatsApp"
        >
          WhatsApp
        </button>
      ) : null}
      additionalFilter={hasDateFilter || statusFilter !== null ? additionalFilter : null}
      extraFilters={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {/* Status badge filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusFilter(null)}
              style={{
                padding: '3px 12px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer',
                border: statusFilter === null ? '2px solid #60a5fa' : '2px solid transparent',
                background: statusFilter === null ? '#1e3a5f' : '#2a2d3a',
                color: statusFilter === null ? '#93c5fd' : '#9ca3af',
                transition: 'all 0.15s',
              }}
            >Todos</button>
            {STATUS_OPTIONS.map(opt => {
              const style = STATUS_STYLE[opt.value] ?? {}
              const active = statusFilter === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(active ? null : opt.value)}
                  style={{
                    padding: '3px 12px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
                    cursor: 'pointer',
                    background: active ? style.background : '#2a2d3a',
                    color: active ? style.color : '#9ca3af',
                    border: active ? `2px solid ${style.background}` : '2px solid transparent',
                    opacity: active ? 1 : 0.75,
                    transition: 'all 0.15s',
                  }}
                >{opt.label}</button>
              )
            })}
          </div>
          {/* Date range filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#aaa', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>De</span>
            <div className="date-picker-wrapper">
              <input
                type="text" value={fromDisplay} placeholder="dd/mm/aaaa" maxLength={10}
                className="crud-search" style={{ width: '120px' }}
                onChange={e => setFromDisplay(maskDate(e.target.value))}
              />
              <input type="date" ref={fromPickerRef} className="hidden-date-picker"
                onChange={e => setFromDisplay(isoToBR(e.target.value))} />
              <button type="button" className="btn-calendar"
                onClick={() => fromPickerRef.current?.showPicker()}>📅</button>
            </div>
            <span style={{ color: '#aaa', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Até</span>
            <div className="date-picker-wrapper">
              <input
                type="text" value={toDisplay} placeholder="dd/mm/aaaa" maxLength={10}
                className="crud-search" style={{ width: '120px' }}
                onChange={e => setToDisplay(maskDate(e.target.value))}
              />
              <input type="date" ref={toPickerRef} className="hidden-date-picker"
                onChange={e => setToDisplay(isoToBR(e.target.value))} />
              <button type="button" className="btn-calendar"
                onClick={() => toPickerRef.current?.showPicker()}>📅</button>
            </div>
            {hasDateFilter && (
              <button type="button"
                onClick={() => { setFromDisplay(''); setToDisplay('') }}
                style={{ padding: '5px 10px', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid #555', borderRadius: 4, background: '#1a1a1a', color: '#aaa' }}
              >Limpar</button>
            )}
          </div>
        </div>
      }
    />
    </>
  )
}
