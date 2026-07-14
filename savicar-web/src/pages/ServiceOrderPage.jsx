import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getProfile, getUserId } from '../api'
import { useNavigate, useLocation } from 'react-router-dom'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import { loadFilters, saveFilters } from '../filterStorage'
import { CustomerForm } from './CustomerPage'
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
  fetchAllVehicleMake,
  fetchAllVehicleModel,
  createVehicleModel,
  fetchAllTechnician,
  fetchAllServices,
  createServices,
  updateServices,
  deleteServices,
  fetchAllInventory,
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
      setSuggestions([])
      setOpen(false)
      onChange('')
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
      setSuggestions([])
      setOpen(false)
      onChange('')
      return
    }
    const lower = q.toLowerCase()
    const matches = items.filter(i => (getLabel(i) || '').toLowerCase().includes(lower)).slice(0, maxSuggestions)
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
        onBlur={() => { focusedRef.current = false }}
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
      setSuggestions([])
      setOpen(false)
      onChange('')
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

export function NewCarModal({ idCustomer, onSaved, onCancel }) {
  const [car, setCar] = useState({ id_make: '', id_model: '', plate: '', year_make: '', year_model: '', color: '' })
  const [makes, setMakes] = useState([])
  const [vehicleModels, setVehicleModels] = useState([])
  const [newModelOpen, setNewModelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllVehicleMake().then(setMakes).catch(() => {})
    fetchAllVehicleModel().then(setVehicleModels).catch(() => {})
  }, [])

  function handleNewModelSaved(created) {
    const newModel = { ...created, id_make: car.id_make }
    setVehicleModels(prev => [...prev, newModel])
    setCar(prev => ({ ...prev, id_model: newModel.id_model }))
    setNewModelOpen(false)
  }

  const filteredModels = car.id_make
    ? vehicleModels.filter(m => String(m.id_make) === String(car.id_make))
    : vehicleModels

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
    setSaving(true)
    setError(null)
    try {
      const { id_make, ...carPayload } = car
      const created = await createCustomerModel({
        ...carPayload,
        id_model: carPayload.id_model ? Number(carPayload.id_model) : undefined,
        year_make: carPayload.year_make !== '' ? Number(carPayload.year_make) : undefined,
        year_model: carPayload.year_model !== '' ? Number(carPayload.year_model) : undefined,
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
            <label>Placa</label>
            <input type="text" name="plate" value={car.plate} onChange={handleChange} autoFocus />
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
  const totalTerceiros = services.reduce((acc, s) => {
    const tn = s.technician_name
    return (tn === 'Serviço de Terceiro' || tn === 'Serviços de Terceiro') ? acc + Number(s.total_value || 0) : acc
  }, 0)

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
      const price = inv?.sales_price != null ? Number(inv.sales_price) : null
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
  <h1>${data.status === 0 ? 'Orçamento' : 'Ordem de Serviço'} #${data.id_order}</h1>
  <table class="info">
    ${data.customer_name || data.customer_phone ? `<tr><td class="lbl">Cliente</td><td>${[data.customer_name, data.customer_phone].filter(Boolean).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</td></tr>` : ''}
    ${rowPair('Modelo', data.model_name, 'Placa', data.plate_number)}
    ${row('Tipo de Serviço', data.service_type)}
    ${rowPair('Técnico', data.technician_name, 'Data/Hora Entrada', fmtDatetimeBR(data.date_time_in))}
    ${row('Data/Hora Saída', fmtDatetimeBR(data.date_time_out))}
    ${row('Chassi (VIN)', data.vin)}
    ${row('Hodômetro (km)', data.odometer_reading)}
    ${row('Obs. do Cliente', data.customer_notes)}
    ${row('Diagnóstico', data.diagnosis_notes)}
  </table>
  ${servicesHtml}
  ${productsHtml}
  ${paymentsHtml}
  <div class="totals">
    <table class="info">
      ${row('Total OS', fmt(totalAmount))}
      ${totalTerceiros > 0 ? row('Serviços de Terceiros', fmt(totalTerceiros)) : ''}
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
                const price = inv?.sales_price != null ? Number(inv.sales_price) : null
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
  { key: 'date_time_in', label: 'Data', thStyle: { whiteSpace: 'nowrap' }, render: val => {
    if (!val) return ''
    const [date, time] = String(val).split('T').length > 1 ? String(val).split('T') : String(val).split(' ')
    const [y, m, d] = (date ?? '').split('-')
    return `${d}/${m}/${y}${time ? ' ' + time.slice(0, 5) : ''}`
  }},
  { key: 'customer_name', label: 'Cliente' },
  { key: 'model_name', label: 'Modelo' },
  { key: 'plate_number', label: 'Placa' },
  { key: 'status', label: 'Status', thStyle: { width: '1%', whiteSpace: 'nowrap' }, render: val => <StatusBadge value={val} /> },
]

function toDatetimeLocal(value) {
  if (!value) return ''
  return String(value).replace(' ', 'T').slice(0, 16)
}

function nowLocalISO() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
    id_customer: initialData?.id_customer ?? '',
    id_technician: initialData?.id_technician ?? '',
    customer_notes: initialData?.customer_notes ?? '',
    internal_notes: initialData?.internal_notes ?? '',
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
  const [customers, setCustomers] = useState([])
  const [allModels, setAllModels] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCarOpen, setNewCarOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [discountFocused, setDiscountFocused] = useState(false)

  // ── Services panel ────────────────────────────────────────────
  const emptyServiceForm = { code: '', description: '', hours_quantity: '', unit_value: '', total_value: '', id_technician: '', status: '' }
  const [orderServices, setOrderServices] = useState([])
  const [editingService, setEditingService] = useState(null)
  const [serviceForm, setServiceForm] = useState(emptyServiceForm)
  const [serviceSaving, setServiceSaving] = useState(false)
  const [serviceError, setServiceError] = useState(null)

  // ── Products panel ────────────────────────────────────────────
  const emptyProductForm = { id_product: '', quantity: '' }
  const [inventoryItems, setInventoryItems] = useState([])
  const [productMakes, setProductMakes] = useState([])
  const [orderProducts, setOrderProducts] = useState([])
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState(emptyProductForm)
  const [productSaving, setProductSaving] = useState(false)
  const [productError, setProductError] = useState(null)

  // ── Payments panel ────────────────────────────────────────────
  const emptyPaymentForm = { id_payment_method: '', due_date: '', payment_date: '', value: '', installments: 1 }

  function isCreditCard(description) {
    if (!description) return false
    const d = description.toUpperCase()
    return d.includes('CART') || d.includes('CREDITO') || d.includes('CRÉDITO')
  }

  function addMonths(isoDate, months) {
    if (!isoDate) {
      const d = new Date()
      d.setMonth(d.getMonth() + months)
      return d.toISOString().slice(0, 10)
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
    fetchAllTechnician().then(data => {
      setTechnicians(data ?? [])
      if (isTecnico && myUserId) {
        const myTech = (data ?? []).find(t => t.id_user === myUserId)
        if (myTech) setServiceForm(prev => ({ ...prev, id_technician: myTech.id_technician }))
      }
    }).catch(() => {})
    fetchAllInventory().then(data => setInventoryItems(data ?? [])).catch(() => {})
    fetchAllVehicleMake().then(data => setProductMakes(data ?? [])).catch(() => {})
    fetchAllPaymentMethod().then(data => setPaymentMethods(data ?? [])).catch(() => {})
    if (isEdit) {
      fetchAllServices()
        .then(all => setOrderServices(all.filter(s => s.id_order === initialData.id_order)))
        .catch(() => {})
      fetchServiceOrderProductsByOrder(initialData.id_order)
        .then(data => setOrderProducts(data ?? []))
        .catch(err => setProductError('Erro ao carregar produtos: ' + err.message))
      fetchPaymentsByOrder(initialData.id_order)
        .then(data => setOrderPayments(data ?? []))
        .catch(err => setPaymentError('Erro ao carregar pagamentos: ' + err.message))
    }
  }, [])

  function openNewService() {
    setServiceForm(emptyServiceForm)
    setEditingService({})
    setServiceError(null)
  }

  function openEditService(s) {
    setServiceForm({
      code: s.code ?? '',
      description: s.description ?? '',
      hours_quantity: s.hours_quantity ?? '',
      unit_value: s.unit_value ?? '',
      total_value: s.total_value ?? '',
      id_technician: s.id_technician ?? '',
      status: s.status ?? '',
    })
    setEditingService(s)
    setServiceError(null)
  }

  function handleServiceChange(e) {
    const { name, value } = e.target
    setServiceForm(prev => {
      const next = { ...prev, [name]: value }
      if ((name === 'hours_quantity' || name === 'unit_value') && next.hours_quantity !== '' && next.unit_value !== '') {
        next.total_value = (Number(next.hours_quantity) * Number(next.unit_value)).toFixed(2)
      }
      return next
    })
  }

  function buildServicePayload(idOrder) {
    return {
      code: serviceForm.code || null,
      description: serviceForm.description || null,
      hours_quantity: serviceForm.hours_quantity !== '' ? Number(serviceForm.hours_quantity) : null,
      unit_value: serviceForm.unit_value !== '' ? Number(serviceForm.unit_value) : null,
      total_value: serviceForm.total_value !== '' ? Number(serviceForm.total_value) : null,
      id_order: idOrder ? Number(idOrder) : null,
      id_technician: serviceForm.id_technician !== '' ? Number(serviceForm.id_technician) : null,
      status: serviceForm.status !== '' ? Number(serviceForm.status) : null,
    }
  }

  async function handleServiceSave() {
    setServiceSaving(true)
    setServiceError(null)
    try {
      const techName = technicians.find(t => t.id_technician === Number(serviceForm.id_technician))?.name ?? null
      if (editingService.id_service) {
        const payload = buildServicePayload(initialData.id_order)
        await updateServices(editingService.id_service, payload)
        setOrderServices(prev => prev.map(s => s.id_service === editingService.id_service
          ? { ...s, ...payload, id_service: s.id_service, technician_name: techName }
          : s))
      } else if (isEdit) {
        const created = await createServices(buildServicePayload(initialData.id_order))
        setOrderServices(prev => [...prev, { ...created, technician_name: techName }])
      } else {
        setOrderServices(prev => [...prev, { ...serviceForm, technician_name: techName, _tempId: Date.now() }])
      }
      setEditingService(null)
    } catch (err) {
      setServiceError(err.message)
    } finally {
      setServiceSaving(false)
    }
  }

  async function handleServiceDelete(s) {
    if (!window.confirm('Excluir serviço?')) return
    if (s.id_service) {
      try {
        await deleteServices(s.id_service)
        setOrderServices(prev => prev.filter(x => x.id_service !== s.id_service))
      } catch (err) {
        alert('Erro ao excluir: ' + err.message)
      }
    } else {
      setOrderServices(prev => prev.filter(x => x._tempId !== s._tempId))
    }
  }

  function openNewProduct() {
    setProductForm(emptyProductForm)
    setEditingProduct({})
    setProductError(null)
  }

  function openEditProduct(p) {
    setProductForm({
      id_product: p.id_product ?? '',
      quantity: p.quantity ?? '',
    })
    setEditingProduct(p)
    setProductError(null)
  }

  function handleProductChange(e) {
    const { name, value } = e.target
    setProductForm(prev => ({ ...prev, [name]: value }))
  }

  function buildProductPayload(idOrder) {
    return {
      id_order: idOrder ? Number(idOrder) : null,
      id_product: productForm.id_product !== '' ? Number(productForm.id_product) : null,
      quantity: productForm.quantity !== '' ? Number(productForm.quantity) : null,
    }
  }

  async function handleProductSave() {
    if (!productForm.id_product || !productForm.quantity) {
      setProductError('Selecione o produto e informe a quantidade.')
      return
    }
    setProductSaving(true)
    setProductError(null)
    try {
      if (editingProduct.id_service_order_product) {
        const payload = buildProductPayload(initialData.id_order)
        const updated = await updateServiceOrderProduct(editingProduct.id_service_order_product, payload)
        setOrderProducts(prev => prev.map(p =>
          p.id_service_order_product === editingProduct.id_service_order_product ? { ...updated } : p
        ))
      } else if (isEdit) {
        const created = await createServiceOrderProduct(buildProductPayload(initialData.id_order))
        const inv = inventoryItems.find(i => i.id_product === created.id_product)
        setOrderProducts(prev => [...prev, { ...created, product_name: inv?.name ?? null }])
      } else {
        const inv = inventoryItems.find(i => i.id_product === Number(productForm.id_product))
        setOrderProducts(prev => [...prev, { ...productForm, product_name: inv?.name ?? null, _tempId: Date.now() }])
      }
      setEditingProduct(null)
    } catch (err) {
      setProductError(err.message)
    } finally {
      setProductSaving(false)
    }
  }

  async function handleProductDelete(p) {
    if (!window.confirm('Excluir produto da OS?')) return
    if (p.id_service_order_product) {
      try {
        await deleteServiceOrderProduct(p.id_service_order_product)
        setOrderProducts(prev => prev.filter(x => x.id_service_order_product !== p.id_service_order_product))
      } catch (err) {
        alert('Erro ao excluir: ' + err.message)
      }
    } else {
      setOrderProducts(prev => prev.filter(x => x._tempId !== p._tempId))
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
            return acc + (inv?.sales_price != null ? Number(inv.sales_price) * Number(p.quantity || 0) : 0)
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
      } else {
        // Single payment
        if (isEdit) {
          const created = await createPayment(buildPaymentPayload(initialData.id_order))
          setOrderPayments(prev => [...prev, { ...created, payment_method_description: method?.description ?? null }])
        } else {
          setOrderPayments(prev => [...prev, { ...paymentForm, payment_method_description: method?.description ?? null, _tempId: Date.now() }])
        }
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

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
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
    } else {
      setForm(prev => ({ ...prev, date_time_in: '' }))
    }
  }

  async function saveOrder(overrideStatus) {
    setSaving(true)
    setError(null)
    try {
      // Flush any open sub-editors so unsaved rows are included on main save
      let pendingServices  = orderServices
      let pendingProducts  = orderProducts
      let pendingPayments  = orderPayments

      if (editingService !== null) {
        const techName = technicians.find(t => t.id_technician === Number(serviceForm.id_technician))?.name ?? null
        if (isEdit) {
          if (editingService.id_service) {
            const payload = buildServicePayload(initialData.id_order)
            await updateServices(editingService.id_service, payload)
            pendingServices = pendingServices.map(s => s.id_service === editingService.id_service ? { ...s, ...payload, id_service: s.id_service, technician_name: techName } : s)
          } else {
            const created = await createServices(buildServicePayload(initialData.id_order))
            pendingServices = [...pendingServices, { ...created, technician_name: techName }]
          }
        } else {
          pendingServices = [...pendingServices, { ...serviceForm, technician_name: techName, _tempId: Date.now() }]
        }
        setOrderServices(pendingServices)
        setEditingService(null)
      }

      if (editingProduct !== null && productForm.id_product && productForm.quantity) {
        const inv = inventoryItems.find(i => i.id_product === Number(productForm.id_product))
        if (isEdit) {
          if (editingProduct.id_service_order_product) {
            const payload = buildProductPayload(initialData.id_order)
            const updated = await updateServiceOrderProduct(editingProduct.id_service_order_product, payload)
            pendingProducts = pendingProducts.map(p => p.id_service_order_product === editingProduct.id_service_order_product ? { ...updated } : p)
          } else {
            const created = await createServiceOrderProduct(buildProductPayload(initialData.id_order))
            pendingProducts = [...pendingProducts, { ...created, product_name: inv?.name ?? null }]
          }
        } else {
          pendingProducts = [...pendingProducts, { ...productForm, product_name: inv?.name ?? null, _tempId: Date.now() + 1 }]
        }
        setOrderProducts(pendingProducts)
        setEditingProduct(null)
      }

      if (editingPayment !== null && paymentForm.id_payment_method) {
        const method = paymentMethods.find(m => m.id_payment_method === Number(paymentForm.id_payment_method))
        if (isEdit) {
          if (editingPayment.id_payment) {
            const payload = buildPaymentPayload(initialData.id_order)
            const updated = await updatePayment(editingPayment.id_payment, payload)
            pendingPayments = pendingPayments.map(p => p.id_payment === editingPayment.id_payment ? { ...updated, payment_method_description: method?.description ?? null } : p)
          } else {
            const created = await createPayment(buildPaymentPayload(initialData.id_order))
            pendingPayments = [...pendingPayments, { ...created, payment_method_description: method?.description ?? null }]
          }
        } else {
          pendingPayments = [...pendingPayments, { ...paymentForm, payment_method_description: method?.description ?? null, _tempId: Date.now() + 2 }]
        }
        setOrderPayments(pendingPayments)
        setEditingPayment(null)
      }

      const fmtDatetime = v => v ? v.replace('T', ' ') + (v.length === 16 ? ':00' : '') : null
      const totalServices = pendingServices.reduce((acc, s) => acc + (s.total_value != null ? Number(s.total_value) : 0), 0)
      const totalProducts = pendingProducts.reduce((acc, p) => {
        const inv = inventoryItems.find(i => i.id_product === Number(p.id_product))
        return acc + (inv?.sales_price != null ? Number(inv.sales_price) * Number(p.quantity || 0) : 0)
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
          })
        }
        for (const p of pendingProducts) {
          await createServiceOrderProduct({
            id_order: created.id_order,
            id_product: p.id_product !== '' ? Number(p.id_product) : null,
            quantity: p.quantity !== '' ? Number(p.quantity) : null,
          })
        }
        for (const p of pendingPayments) {
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
        setOrderServices(prev => prev.map(s => ({ ...s, status: 5 })))
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
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Data/Hora de Entrada</label>
          <input type="text" name="date_time_in" value={dateTimeInDisplay} onChange={handleDateTimeInChange} placeholder="dd/mm/aaaa hh:mm" maxLength={16} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Técnico Responsável</label>
          <SelectAutocomplete
            items={technicians.filter(t => t.id_user != null)}
            value={form.id_technician}
            onChange={val => setForm(prev => ({ ...prev, id_technician: val }))}
            getId={t => t.id_user}
            getLabel={t => t.name}
            placeholder="Digite o nome do técnico..."
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Chassi (VIN)</label>
          <input
            type="text"
            value={allModels.find(m => String(m.id_customer_model) === String(form.id_customer_model))?.vin ?? initialData?.vin ?? ''}
            readOnly
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Hodômetro (km)</label>
          <input
            type="number"
            name="odometer_reading"
            value={form.odometer_reading}
            onChange={handleChange}
            min="0"
            step="1"
            placeholder="Leitura do hodômetro"
          />
        </div>
      </div>
      <div className="form-group">
        <label>Observações do Cliente</label>
        <textarea name="customer_notes" value={form.customer_notes} onChange={handleChange} rows={3} />
      </div>
      <div className="form-group">
        <label>Observações Internas</label>
        <textarea name="internal_notes" value={form.internal_notes} onChange={handleChange} rows={3} />
      </div>
      <div className="form-group">
        <label>Diagnóstico</label>
        <textarea name="diagnosis_notes" value={form.diagnosis_notes} onChange={handleChange} rows={3} />
      </div>
      {/* ── Services section ─────────────────────────────────── */}
      <div className="contact-section">
        <div className="contact-section-header">
          <span>Serviços</span>
          <button type="button" className="btn-add-contact" onClick={openNewService} disabled={editingService !== null}>
            + Adicionar
          </button>
        </div>

        {orderServices.length > 0 && (
          <table className="services-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Técnico</th>
                <th>Horas</th>
                {!isTecnico && <th>Valor Unit.</th>}
                {!isTecnico && <th>Total</th>}
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orderServices.map((s, idx) => {
                const tech = technicians.find(t => t.id_technician === Number(s.id_technician))
                const svcStatusColors = {
                  0: { bg: '#374151', color: '#9ca3af' },
                  1: { bg: '#555965', color: '#e0e0e0' },
                  2: { bg: '#b89a00', color: '#1a1a1a' },
                  3: { bg: '#3a6ea8', color: '#fff'    },
                  4: { bg: '#a0611a', color: '#fff'    },
                  5: { bg: '#27863f', color: '#fff'    },
                  6: { bg: '#7f1d1d', color: '#fca5a5' },
                }
                const svcStatusOpts = [
                  { value: 0, label: 'Orçamento'        },
                  { value: 1, label: 'Aberta'           },
                  { value: 2, label: 'Andamento'        },
                  { value: 3, label: 'Aguardando Peças' },
                  { value: 4, label: 'Em Teste'         },
                  { value: 5, label: 'Concluído'        },
                  { value: 6, label: 'Não aprovado'     },
                ]
                const currentStatus = s.status != null ? Number(s.status) : ''
                const sc = svcStatusColors[currentStatus] ?? {}
                return (
                  <tr key={s.id_service ?? s._tempId ?? idx}>
                    <td>{s.description ?? ''}</td>
                    <td>{s.technician_name ?? tech?.name ?? ''}</td>
                    <td>{s.hours_quantity ?? ''}</td>
                    {!isTecnico && <td>{s.unit_value != null ? Number(s.unit_value).toFixed(2) : ''}</td>}
                    {!isTecnico && <td>{s.total_value != null ? Number(s.total_value).toFixed(2) : ''}</td>}
                    <td>
                      <select
                        value={currentStatus}
                        onChange={async e => {
                          const newStatus = e.target.value !== '' ? Number(e.target.value) : null
                          const updated = { ...s, status: newStatus }
                          setOrderServices(prev => prev.map(x => {
                            if (s.id_service) return x.id_service === s.id_service ? updated : x
                            return s._tempId && x._tempId === s._tempId ? updated : x
                          }))
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
                                status: newStatus,
                              })
                            } catch (err) {
                              alert('Erro ao salvar status: ' + err.message)
                            }
                          }
                        }}
                        style={{
                          background: sc.bg ?? '#2a2a2a',
                          color: sc.color ?? '#ccc',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '3px 6px',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          minWidth: '120px',
                        }}
                      >
                        <option value="">— Status —</option>
                        {svcStatusOpts.map(opt => (
                          <option key={opt.value} value={opt.value}
                            style={{ background: svcStatusColors[opt.value]?.bg ?? '#1a1a1a', color: svcStatusColors[opt.value]?.color ?? '#ccc' }}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="actions-col">
                      <button type="button" className="btn-edit" onClick={() => openEditService(s)}>Editar</button>
                      <button type="button" className="btn-delete" onClick={() => handleServiceDelete(s)}>Excluir</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {editingService !== null && createPortal(
          <div className="form-modal-overlay" onClick={() => setEditingService(null)}>
            <div className="form-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div className="form-modal-header">
                <span>{editingService.id_service ? 'Editar Serviço' : 'Novo Serviço'}{orderId ? ` — OS #${orderId}` : ''}</span>
                <button className="modal-close" onClick={() => setEditingService(null)}>✕</button>
              </div>
              <div style={{ padding: '1rem' }}>
                <div className="form-group">
                  <label>Descrição</label>
                  <input type="text" name="description" value={serviceForm.description} onChange={handleServiceChange} autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isTecnico ? '2fr 1fr' : '2fr 1fr 1fr', gap: '0 16px' }}>
                  <div className="form-group">
                    <label>Técnico</label>
                    {isTecnico ? (
                      <input type="text" value={technicians.find(t => t.id_user === myUserId)?.name ?? ''} readOnly />
                    ) : (
                      <SelectAutocomplete
                        items={technicians}
                        value={serviceForm.id_technician}
                        onChange={val => setServiceForm(prev => ({ ...prev, id_technician: val }))}
                        getId={t => t.id_technician}
                        getLabel={t => t.name ?? ''}
                        placeholder="Digite o nome do técnico..."
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Horas</label>
                    <input type="number" name="hours_quantity" value={serviceForm.hours_quantity} onChange={handleServiceChange} min="0" step="any" />
                  </div>
                  {!isTecnico && <div className="form-group">
                    <label>Valor Unitário</label>
                    <input type="number" name="unit_value" value={serviceForm.unit_value} onChange={handleServiceChange} min="0" step="0.01" />
                  </div>}
                </div>
                {!isTecnico && <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                  <div className="form-group" style={{ width: 140, flexShrink: 0 }}>
                    <label>Total</label>
                    <input type="number" name="total_value" value={serviceForm.total_value} onChange={handleServiceChange} min="0" step="0.01" />
                  </div>
                  <div className="form-actions" style={{ margin: 0, paddingBottom: '1px' }}>
                    <button type="button" className="btn-novo" onClick={handleServiceSave} disabled={serviceSaving}>
                      {serviceSaving ? 'Salvando...' : 'Salvar serviço'}
                    </button>
                    <button type="button" onClick={() => setEditingService(null)}>Cancelar</button>
                  </div>
                </div>}
                {isTecnico && <div className="form-actions">
                  <button type="button" className="btn-novo" onClick={handleServiceSave} disabled={serviceSaving}>
                    {serviceSaving ? 'Salvando...' : 'Salvar serviço'}
                  </button>
                  <button type="button" onClick={() => setEditingService(null)}>Cancelar</button>
                </div>}
                {serviceError && <p className="error">{serviceError}</p>}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* ── Products section ─────────────────────────────────── */}
      <div className="contact-section">
        <div className="contact-section-header">
          <span>Produtos</span>
          <button type="button" className="btn-add-contact" onClick={openNewProduct}>
            + Adicionar
          </button>
        </div>

        {productError && editingProduct === null && <p className="error">{productError}</p>}

        {orderProducts.length > 0 && (
          <table className="services-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd</th>
                {!isTecnico && <th>Valor Unit.</th>}
                {!isTecnico && <th>Total</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orderProducts.map((p, idx) => {
                const inv = inventoryItems.find(i => i.id_product === Number(p.id_product))
                const price = inv?.sales_price != null ? Number(inv.sales_price) : null
                const lineTotal = price != null && p.quantity ? price * Number(p.quantity) : null
                const makerName = inv?.id_make ? (productMakes.find(m => m.id_make === inv.id_make)?.name ?? '') : ''
                const productLabel = [p.product_name ?? inv?.name, makerName].filter(Boolean).join(' · ')
                return (
                  <tr key={p.id_service_order_product ?? p._tempId ?? idx}>
                    <td>
                      <div>{productLabel || p.id_product}</div>
                      {inv?.current_quantity != null && (
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>Estoque: {inv.current_quantity}</div>
                      )}
                    </td>
                    <td>{p.quantity}</td>
                    {!isTecnico && <td>{price != null ? price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>}
                    {!isTecnico && <td>{lineTotal != null ? lineTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>}
                    <td className="actions-col">
                      <button type="button" className="btn-edit" onClick={() => openEditProduct(p)}>Editar</button>
                      <button type="button" className="btn-delete" onClick={() => handleProductDelete(p)}>Excluir</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {editingProduct !== null && createPortal(
          <div className="form-modal-overlay" onClick={() => setEditingProduct(null)}>
            <div className="form-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className="form-modal-header">
                <span>{editingProduct.id_service_order_product ? 'Editar Produto' : 'Novo Produto'}{orderId ? ` — OS #${orderId}` : ''}</span>
                <button className="modal-close" onClick={() => setEditingProduct(null)}>✕</button>
              </div>
              <div style={{ padding: '1rem' }}>
                <div className="form-group">
                  <label>Produto</label>
                  <SelectAutocomplete
                    items={inventoryItems}
                    value={productForm.id_product}
                    onChange={val => setProductForm(prev => ({ ...prev, id_product: val }))}
                    getId={i => i.id_product}
                    getLabel={i => {
                      const maker = i.id_make ? (productMakes.find(m => m.id_make === i.id_make)?.name ?? '') : ''
                      const parts = [i.name, maker].filter(Boolean).join(' · ')
                      const qty = i.current_quantity != null ? ` (Estoque: ${i.current_quantity})` : ''
                      return parts + (i.code ? ` [${i.code}]` : '') + qty
                    }}
                    placeholder="Digite o nome ou código..."
                  />
                </div>
                {productForm.id_product !== '' && (() => {
                  const inv = inventoryItems.find(i => i.id_product === Number(productForm.id_product))
                  return inv?.sales_price != null && !isTecnico ? (
                    <div className="form-group">
                      <label>Valor Unit.</label>
                      <input type="text" value={Number(inv.sales_price).toFixed(2)} readOnly />
                    </div>
                  ) : null
                })()}
                <div className="form-group">
                  <label>Quantidade</label>
                  <input type="number" name="quantity" value={productForm.quantity} onChange={handleProductChange} min="0.001" step="any" />
                </div>
                {productError && <p className="error">{productError}</p>}
                <div className="form-actions">
                  <button type="button" className="btn-novo" onClick={handleProductSave} disabled={productSaving}>
                    {productSaving ? 'Salvando...' : 'Salvar produto'}
                  </button>
                  <button type="button" onClick={() => setEditingProduct(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* ── Payments section ─────────────────────────────────── */}
      {!isTecnico && <div className="contact-section">
        <div className="contact-section-header">
          <span>Pagamentos</span>
          <button type="button" className="btn-add-contact" onClick={openNewPayment} disabled={editingPayment !== null}>
            + Adicionar
          </button>
        </div>

        {paymentError && editingPayment === null && <p className="error">{paymentError}</p>}

        {orderPayments.length > 0 && (
          <table className="services-table">
            <thead>
              <tr>
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
            {(() => {
              const selectedMethod = paymentMethods.find(m => m.id_payment_method === Number(paymentForm.id_payment_method))
              const showInstallments = isCreditCard(selectedMethod?.description) && !editingPayment?.id_payment
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: showInstallments ? '1fr 1.5fr 0.7fr' : '1fr 2fr', gap: '0 16px' }}>
                    <div className="form-group">
                      <label>Valor</label>
                      <input type="number" name="value" value={paymentForm.value} onChange={handlePaymentChange} min="0" step="0.01" />
                    </div>
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
                    {showInstallments && (
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
                    )}
                  </div>
                </>
              )
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
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
          return acc + (inv?.sales_price != null ? Number(inv.sales_price) * Number(p.quantity || 0) : 0)
        }, 0)
        const total = totalServices + totalProducts
        const totalThirdParty = orderServices.reduce((acc, s) => {
          const techName = technicians.find(t => t.id_technician === Number(s.id_technician))?.name ?? s.technician_name
          return (techName === 'Serviço de Terceiro' || techName === 'Serviços de Terceiro') ? acc + (s.total_value != null ? Number(s.total_value) : 0) : acc
        }, 0)
        const discount = Number(form.discount) || 0
        const finalAmount = total - discount
        const totalPago = orderPayments.reduce((acc, p) => acc + (p.payment_date ? Number(p.value || 0) : 0), 0)
        const totalAberto = finalAmount - totalPago
        const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const roStyle = { color: '#fff', fontWeight: 700, width: '150px' }
        return (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 'none' }}>
              <label><strong>Total OS</strong></label>
              <input type="text" value={fmt(total)} readOnly style={roStyle} />
            </div>
            <div className="form-group" style={{ flex: 'none' }}>
              <label><strong>Serviços de Terceiros</strong></label>
              <input type="text" value={fmt(totalThirdParty)} readOnly style={roStyle} />
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

export const { NewPage: ServiceOrderNewPage } = makeFormPages(ServiceOrderForm, 'Ordens de Serviço', '/service-orders')

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
        <h2>Editar — Ordens de Serviço</h2>
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

function WppSendModal({ order, onClose }) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [noPhone, setNoPhone] = useState(false)
  const [manualPhone, setManualPhone] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSend(phoneOverride) {
    setSending(true)
    setError(null)
    try {
      await sendServiceOrderWhatsApp(order.id_order, phoneOverride ?? '')
      setSent(true)
    } catch (e) {
      if (e.code === 'no_phone') { setNoPhone(true); setSending(false); return }
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
        ) : noPhone ? (
          <div style={{ padding: '1rem' }}>
            <p style={{ color: '#f59e0b', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              O cliente não possui número de WhatsApp cadastrado. Informe o número abaixo:
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

const SO_FILTERS_KEY = '/service-orders:extra'

export default function ServiceOrderPage() {
  const todayBR = isoToBR(new Date().toISOString().slice(0, 10))
  const initialExtraFilters = loadFilters(SO_FILTERS_KEY, { fromDisplay: todayBR, toDisplay: todayBR, statusFilter: null })
  const [fromDisplay, setFromDisplay] = useState(initialExtraFilters.fromDisplay)
  const [toDisplay,   setToDisplay]   = useState(initialExtraFilters.toDisplay)
  const [sendWpp, setSendWpp] = useState(false)
  const [wppOrder, setWppOrder] = useState(null)
  const [statusFilter, setStatusFilter] = useState(initialExtraFilters.statusFilter) // null = all
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
      title="🔧⚙️ Ordens de Serviço"
      fetchAll={fetchAllServiceOrder}
      deleteItem={deleteServiceOrder}
      fields={FIELDS}
      FormComponent={ServiceOrderForm}
      createLabel="+ Nova OS"
      filterKeys={['id_order', 'customer_name', 'model_name', 'plate_number']}
      filterPlaceholder="OS, Cliente, Modelo ou Placa..."
      DetailComponent={ServiceOrderDetailFull}
      closeOnOverlayClick={false}
      basePath="/service-orders"
      pageSize={20}
      rowActions={sendWpp ? (item) => (
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
                padding: '3px 12px',
                borderRadius: 12,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: statusFilter === null ? '2px solid #60a5fa' : '2px solid transparent',
                background: statusFilter === null ? '#1e3a5f' : '#2a2d3a',
                color: statusFilter === null ? '#93c5fd' : '#9ca3af',
                transition: 'all 0.15s',
              }}
            >
              Todos
            </button>
            {STATUS_OPTIONS.map(opt => {
              const style = STATUS_STYLE[opt.value] ?? {}
              const active = statusFilter === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(active ? null : opt.value)}
                  style={{
                    padding: '3px 12px',
                    borderRadius: 12,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: active ? style.background : '#2a2d3a',
                    color: active ? style.color : '#9ca3af',
                    border: active ? `2px solid ${style.background}` : '2px solid transparent',
                    opacity: active ? 1 : 0.75,
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
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
