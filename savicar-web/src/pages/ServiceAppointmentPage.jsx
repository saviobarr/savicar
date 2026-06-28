import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import { NewCustomerModal, NewCarModal } from './ServiceOrderPage'
import {
  fetchAllServiceAppointment,
  createServiceAppointment,
  updateServiceAppointment,
  deleteServiceAppointment,
  fetchAllCustomer,
  fetchAllCustomerModel,
  fetchAllTechnician,
  fetchAllResource,
  fetchAppointmentResourcesByAppointment,
  createAppointmentResource,
  updateAppointmentResource,
  deleteAppointmentResource,
} from '../api'

// ── Status domain ─────────────────────────────────────────────
export const STATUS_LABELS = {
  1: 'Agendado',
  2: 'Confirmado',
  3: 'Em atendimento',
  4: 'Atendimento finalizado',
  5: 'Cancelado',
  6: 'No Show',
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value: Number(value), label }))

const STATUS_COLORS = {
  1: '#3b82f6',
  2: '#10b981',
  3: '#f59e0b',
  4: '#6366f1',
  5: '#ef4444',
  6: '#6b7280',
}

function StatusBadge({ status }) {
  if (!status) return null
  const label = STATUS_LABELS[status] ?? status
  const color = STATUS_COLORS[status] ?? '#6b7280'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: '0.8rem', fontWeight: 600,
      background: color + '22', color, border: `1px solid ${color}55`, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Date/time helpers ─────────────────────────────────────────
function fmtDatetimeBR(val) {
  if (!val) return ''
  const s = String(val).replace('T', ' ')
  const [datePart, timePart] = s.split(' ')
  if (!datePart) return ''
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year}${timePart ? ' ' + timePart.slice(0, 5) : ''}`
}

function maskDatetime(val) {
  const d = val.replace(/\D/g, '').slice(0, 12)
  let r = d
  if (d.length > 2)  r = d.slice(0, 2) + '/' + d.slice(2)
  if (d.length > 4)  r = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4)
  if (d.length > 8)  r = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4, 8) + ' ' + d.slice(8)
  if (d.length > 10) r = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4, 8) + ' ' + d.slice(8, 10) + ':' + d.slice(10)
  return r
}

function displayToISO(display) {
  const d = display.replace(/\D/g, '')
  if (d.length < 12) return ''
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)} ${d.slice(8, 10)}:${d.slice(10, 12)}:00`
}

function isoToDisplay(iso) {
  if (!iso) return ''
  const s = String(iso).replace('T', ' ').replace('Z', '')
  const [datePart, timePart] = s.split(' ')
  if (!datePart) return ''
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year}${timePart ? ' ' + timePart.slice(0, 5) : ''}`
}

// Normalise any ISO variant to the "YYYY-MM-DD HH:MM:SS" format MySQL expects
function normalizeForDB(val) {
  if (!val) return ''
  return String(val).replace('T', ' ').replace('Z', '').slice(0, 19)
}

function DateTimeInput({ label, isoValue, onChange }) {
  const [display, setDisplay] = useState(() => isoToDisplay(isoValue))
  function handleChange(e) {
    const masked = maskDatetime(e.target.value)
    setDisplay(masked)
    onChange(displayToISO(masked))
  }
  return (
    <div className="form-group">
      <label>{label}</label>
      <input type="text" value={display} onChange={handleChange} placeholder="dd/mm/aaaa hh:mm" maxLength={16} />
    </div>
  )
}

// ── Generic autocomplete (portal-based) ──────────────────────
function SelectAutocomplete({ items, value, onChange, getId, getLabel, placeholder, disabled }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const inputRef = useRef(null)

  useEffect(() => {
    if (value && items.length) {
      const found = items.find(i => String(getId(i)) === String(value))
      if (found) setQuery(getLabel(found))
    } else if (!value) {
      setQuery('')
    }
  }, [value, items])

  function openDropdown(list) {
    if (!list.length) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: rect.width, zIndex: 9999 })
    setSuggestions(list)
    setOpen(true)
  }

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    if (!q.trim()) { setSuggestions([]); setOpen(false); onChange(''); return }
    openDropdown(items.filter(i => (getLabel(i) ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 15))
  }

  function handleFocus() {
    if (!query.trim()) openDropdown(items.slice(0, 15))
    else if (suggestions.length) {
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
    function outside(e) { if (inputRef.current && !inputRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  return (
    <div className="autocomplete-wrapper">
      <input ref={inputRef} type="text" value={query} onChange={handleInput} onFocus={handleFocus}
        placeholder={placeholder} autoComplete="off" disabled={disabled} />
      {open && suggestions.length > 0 && createPortal(
        <ul className="autocomplete-list" style={dropdownStyle}>
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

// ── Customer autocomplete ─────────────────────────────────────
function customerDisplayName(c) {
  return c.individual_name || c.trade_name || c.legal_name || `Cliente #${c.id_customer}`
}

function CustomerAutocomplete({ value, onChange, customers }) {
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
    if (!q.trim()) { setSuggestions([]); setOpen(false); onChange(''); return }
    setSuggestions(customers.filter(c => customerDisplayName(c).toLowerCase().includes(q.toLowerCase()) || (c.tax_id || '').includes(q)))
    setOpen(true)
  }

  function handleFocus() {
    if (!query.trim()) { setSuggestions(customers); setOpen(customers.length > 0) }
    else setOpen(suggestions.length > 0)
  }

  function handleSelect(c) {
    setQuery(customerDisplayName(c)); setSuggestions([]); setOpen(false); onChange(c.id_customer)
  }

  useEffect(() => {
    function outside(e) { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  return (
    <div className="autocomplete-wrapper" ref={containerRef}>
      <input type="text" value={query} onChange={handleInput} onFocus={handleFocus}
        placeholder="Digite o nome ou CPF/CNPJ..." autoComplete="off" />
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

// ── Customer model autocomplete ───────────────────────────────
function customerModelLabel(m) {
  return [m.model_name, m.plate].filter(Boolean).join(' · ') || `Veículo #${m.id_customer_model}`
}

function CustomerModelAutocomplete({ value, onChange, idCustomer, allModels }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const disabled = !idCustomer
  const customerModels = allModels.filter(m => m.id_customer === Number(idCustomer))

  useEffect(() => { setQuery(''); setSuggestions([]); setOpen(false) }, [idCustomer])

  useEffect(() => {
    if (value && allModels.length) {
      const found = allModels.find(m => m.id_customer_model === Number(value))
      if (found) setQuery(customerModelLabel(found))
    } else if (!value) setQuery('')
  }, [value, allModels])

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    if (!q.trim()) { setSuggestions([]); setOpen(false); onChange(''); return }
    setSuggestions(customerModels.filter(m => customerModelLabel(m).toLowerCase().includes(q.toLowerCase())).slice(0, 10))
    setOpen(true)
  }

  function handleFocus() {
    if (!query.trim()) { setSuggestions(customerModels.slice(0, 10)); setOpen(customerModels.length > 0) }
    else if (suggestions.length) setOpen(true)
  }

  function handleSelect(m) {
    setQuery(customerModelLabel(m)); setSuggestions([]); setOpen(false); onChange(m.id_customer_model)
  }

  useEffect(() => {
    function outside(e) { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  return (
    <div className="autocomplete-wrapper" ref={containerRef}>
      <input type="text" value={query} onChange={handleInput} onFocus={handleFocus}
        placeholder={disabled ? 'Selecione um cliente primeiro...' : 'Digite a placa ou modelo...'}
        autoComplete="off" disabled={disabled} />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map(m => (
            <li key={m.id_customer_model} onMouseDown={() => handleSelect(m)}>
              <span className="autocomplete-name">{customerModelLabel(m)}</span>
              <span className="autocomplete-meta">#{m.id_customer_model}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Table columns ─────────────────────────────────────────────
const FIELDS = [
  { key: 'start_at',      label: 'Início',   render: v => fmtDatetimeBR(v) },
  { key: 'customer_name', label: 'Cliente',  render: v => v ?? '—' },
  { key: 'plate_number',  label: 'Veículo',  render: (v, item) => [item.model_name, v].filter(Boolean).join(' · ') || '—' },
  { key: 'status',        label: 'Status',   render: v => <StatusBadge status={v} /> },
]

// ── Form ──────────────────────────────────────────────────────
export function ServiceAppointmentForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData

  const [startAt,         setStartAt]         = useState(() => normalizeForDB(initialData?.start_at))
  const [endAt,           setEndAt]           = useState(() => normalizeForDB(initialData?.end_at))
  const [status,          setStatus]          = useState(initialData?.status   ?? '')
  const [notes,           setNotes]           = useState(initialData?.notes    ?? '')
  const [idCustomerModel, setIdCustomerModel] = useState(initialData?.id_customer_model ?? '')
  const [idCustomer,      setIdCustomer]      = useState('')

  const [customers,   setCustomers]   = useState([])
  const [allModels,   setAllModels]   = useState([])
  const [resources,   setResources]   = useState([])
  const [technicians, setTechnicians] = useState([])
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)

  // ── New customer / new car modal state ───────────────────
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCarOpen,      setNewCarOpen]      = useState(false)

  function handleNewCustomerSaved(created) {
    setCustomers(prev =>
      [...prev, created].sort((a, b) =>
        customerDisplayName(a).localeCompare(customerDisplayName(b), 'pt-BR', { sensitivity: 'base' })
      )
    )
    setIdCustomer(created.id_customer)
    setIdCustomerModel('')
    setNewCustomerOpen(false)
    fetchAllCustomerModel().then(data => setAllModels(data ?? [])).catch(() => {})
  }

  async function handleNewCarSaved(created) {
    try {
      const fresh = await fetchAllCustomerModel()
      setAllModels(fresh ?? [])
    } catch {}
    setIdCustomerModel(created.id_customer_model)
    setNewCarOpen(false)
  }

  // ── Resources panel state ─────────────────────────────────
  const emptyResForm = { id_resource: '', id_technician: '' }
  const [appointmentResources, setAppointmentResources] = useState([])
  const [editingRes,   setEditingRes]   = useState(null)
  const [resForm,      setResForm]      = useState(emptyResForm)
  const [resSaving,    setResSaving]    = useState(false)
  const [resError,     setResError]     = useState(null)

  useEffect(() => {
    fetchAllCustomer()
      .then(data => {
        const sorted = (data ?? []).sort((a, b) =>
          customerDisplayName(a).localeCompare(customerDisplayName(b), 'pt-BR', { sensitivity: 'base' })
        )
        setCustomers(sorted)
        if (initialData?.id_customer_model) {
          fetchAllCustomerModel().then(models => {
            const m = (models ?? []).find(m => m.id_customer_model === initialData.id_customer_model)
            if (m) setIdCustomer(m.id_customer)
            setAllModels(models ?? [])
          }).catch(() => {})
        }
      }).catch(() => {})

    if (!initialData?.id_customer_model) {
      fetchAllCustomerModel().then(data => setAllModels(data ?? [])).catch(() => {})
    }

    fetchAllResource().then(data => setResources(data ?? [])).catch(() => {})
    fetchAllTechnician().then(data => setTechnicians(data ?? [])).catch(() => {})

    if (isEdit) {
      fetchAppointmentResourcesByAppointment(initialData.id_service_appointment)
        .then(data => setAppointmentResources(data ?? []))
        .catch(() => {})
    }
  }, [])

  // Resources panel handlers
  function openNewRes() { setResForm(emptyResForm); setEditingRes({}); setResError(null) }

  function openEditRes(r) {
    setResForm({ id_resource: r.id_resource ?? '', id_technician: r.id_technician ?? '' })
    setEditingRes(r)
    setResError(null)
  }

  async function handleResSave() {
    setResSaving(true)
    setResError(null)
    try {
      const payload = {
        id_service_appointment: isEdit ? initialData.id_service_appointment : 0,
        id_resource:   resForm.id_resource   !== '' ? Number(resForm.id_resource)   : null,
        id_technician: resForm.id_technician !== '' ? Number(resForm.id_technician) : null,
      }
      if (editingRes.id_service_appointment_resource) {
        const updated = await updateAppointmentResource(editingRes.id_service_appointment_resource, payload)
        const res = resources.find(r => r.id_resource === updated.id_resource)
        const tech = technicians.find(t => t.id_technician === updated.id_technician)
        setAppointmentResources(prev => prev.map(r =>
          r.id_service_appointment_resource === editingRes.id_service_appointment_resource
            ? { ...updated, resource_description: res?.description ?? null, technician_name: tech?.name ?? null }
            : r
        ))
      } else if (isEdit) {
        const created = await createAppointmentResource(payload)
        const res = resources.find(r => r.id_resource === created.id_resource)
        const tech = technicians.find(t => t.id_technician === created.id_technician)
        setAppointmentResources(prev => [...prev, { ...created, resource_description: res?.description ?? null, technician_name: tech?.name ?? null }])
      } else {
        // pending — save after appointment is created
        const res = resources.find(r => r.id_resource === Number(resForm.id_resource))
        const tech = technicians.find(t => t.id_technician === Number(resForm.id_technician))
        setAppointmentResources(prev => [...prev, {
          ...payload,
          resource_description: res?.description ?? null,
          technician_name: tech?.name ?? null,
          _tempId: Date.now(),
        }])
      }
      setEditingRes(null)
    } catch (err) {
      setResError(err.message)
    } finally {
      setResSaving(false)
    }
  }

  async function handleResDelete(r) {
    if (!window.confirm('Excluir recurso?')) return
    if (r.id_service_appointment_resource) {
      try {
        await deleteAppointmentResource(r.id_service_appointment_resource)
        setAppointmentResources(prev => prev.filter(x => x.id_service_appointment_resource !== r.id_service_appointment_resource))
      } catch (err) { alert('Erro ao excluir: ' + err.message) }
    } else {
      setAppointmentResources(prev => prev.filter(x => x._tempId !== r._tempId))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        id_customer_model: idCustomerModel !== '' ? Number(idCustomerModel) : null,
        start_at: startAt || null,
        end_at:   endAt   || null,
        status:   status  !== '' ? Number(status) : null,
        notes:    notes   || null,
      }
      if (isEdit) {
        await updateServiceAppointment(initialData.id_service_appointment, payload)
      } else {
        const created = await createServiceAppointment(payload)
        for (const r of appointmentResources) {
          await createAppointmentResource({
            id_service_appointment: created.id_service_appointment,
            id_resource:   r.id_resource   != null ? Number(r.id_resource)   : null,
            id_technician: r.id_technician != null ? Number(r.id_technician) : null,
          })
        }
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="crud-form">

      <div className="form-group">
        <label>Cliente</label>
        <div className="autocomplete-with-add">
          <CustomerAutocomplete
            value={idCustomer}
            onChange={val => { setIdCustomer(val); setIdCustomerModel('') }}
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
      {newCustomerOpen && (
        <NewCustomerModal
          onSaved={handleNewCustomerSaved}
          onCancel={() => setNewCustomerOpen(false)}
        />
      )}

      <div className="form-group">
        <label>Veículo / Modelo</label>
        <div className="autocomplete-with-add">
          <CustomerModelAutocomplete
            value={idCustomerModel}
            onChange={setIdCustomerModel}
            idCustomer={idCustomer}
            allModels={allModels}
          />
          <button
            type="button"
            className="btn-add-inline"
            onClick={() => setNewCarOpen(true)}
            disabled={!idCustomer}
            title="Cadastrar novo veículo"
          >+</button>
        </div>
      </div>
      {newCarOpen && (
        <NewCarModal
          idCustomer={idCustomer}
          onSaved={handleNewCarSaved}
          onCancel={() => setNewCarOpen(false)}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
        <DateTimeInput label="Início" isoValue={startAt} onChange={setStartAt} />
        <DateTimeInput label="Fim"    isoValue={endAt}   onChange={setEndAt} />
        <div className="form-group">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} required>
            <option value="">— Selecione —</option>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Observações</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </div>

      {/* ── Resources section ───────────────────────────────── */}
      <div className="contact-section">
        <div className="contact-section-header">
          <span>Recursos</span>
          <button type="button" className="btn-add-contact" onClick={openNewRes} disabled={editingRes !== null}>
            + Adicionar
          </button>
        </div>

        {appointmentResources.length > 0 && (
          <table className="services-table">
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Técnico</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {appointmentResources.map((r, idx) => (
                <tr key={r.id_service_appointment_resource ?? r._tempId ?? idx}>
                  <td>{r.resource_description ?? '—'}</td>
                  <td>{r.technician_name ?? '—'}</td>
                  <td className="actions-col">
                    <button type="button" className="btn-edit" onClick={() => openEditRes(r)}>Editar</button>
                    <button type="button" className="btn-delete" onClick={() => handleResDelete(r)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {editingRes !== null && (
          <div className="contact-editor">
            <div className="form-group">
              <label>Recurso</label>
              <SelectAutocomplete
                items={resources}
                value={resForm.id_resource}
                onChange={val => setResForm(prev => ({ ...prev, id_resource: val }))}
                getId={r => r.id_resource}
                getLabel={r => r.description ?? ''}
                placeholder="Digite o recurso..."
              />
            </div>
            <div className="form-group">
              <label>Técnico</label>
              <SelectAutocomplete
                items={technicians}
                value={resForm.id_technician}
                onChange={val => setResForm(prev => ({ ...prev, id_technician: val }))}
                getId={t => t.id_technician}
                getLabel={t => t.name ?? ''}
                placeholder="Digite o técnico..."
              />
            </div>
            {resError && <p className="error">{resError}</p>}
            <div className="form-actions">
              <button type="button" className="btn-novo" onClick={handleResSave} disabled={resSaving}>
                {resSaving ? 'Salvando...' : 'Salvar recurso'}
              </button>
              <button type="button" onClick={() => setEditingRes(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: ServiceAppointmentNewPage, EditPage: ServiceAppointmentEditPage } =
  makeFormPages(ServiceAppointmentForm, 'Agendamentos', '/appointments')

function maskDate(val) {
  const d = val.replace(/\D/g, '').slice(0, 8)
  let r = d
  if (d.length > 2) r = d.slice(0, 2) + '/' + d.slice(2)
  if (d.length > 4) r = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4)
  return r
}

function brDateToISO(br) {
  const d = br.replace(/\D/g, '')
  if (d.length !== 8) return ''
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
}

function todayBR() {
  const [y, m, d] = new Date().toISOString().slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export default function ServiceAppointmentPage() {
  const navigate = useNavigate()
  const [filterStatus,   setFilterStatus]   = useState('')
  const [fromDisplay,    setFromDisplay]    = useState(todayBR)
  const [toDisplay,      setToDisplay]      = useState(todayBR)
  const fromPickerRef = useRef(null)
  const toPickerRef   = useRef(null)

  const fromISO = brDateToISO(fromDisplay)
  const toISO   = brDateToISO(toDisplay)

  function additionalFilter(item) {
    if (filterStatus && String(item.status) !== filterStatus) return false
    const itemDate = item.start_at ? String(item.start_at).slice(0, 10) : ''
    if (fromISO && itemDate < fromISO) return false
    if (toISO   && itemDate > toISO)   return false
    return true
  }

  const hasFilter = filterStatus || fromISO || toISO

  return (
    <CrudPage
      title="📅 Agendamentos"
      fetchAll={fetchAllServiceAppointment}
      deleteItem={deleteServiceAppointment}
      fields={FIELDS}
      idKey="id_service_appointment"
      FormComponent={ServiceAppointmentForm}
      filterKeys={['customer_name', 'plate_number']}
      filterPlaceholder="Filtrar por cliente ou placa..."
      createLabel="+ Novo Agendamento"
      pageSize={20}
      basePath="/appointments"
      additionalFilter={hasFilter ? additionalFilter : null}
      rowActions={item => (
        <button
          className="btn-os"
          title="Abrir Ordem de Serviço para este agendamento"
          onClick={() => navigate('/service-orders/new', {
            state: { initialData: {
              id_customer:       item.id_customer,
              id_customer_model: item.id_customer_model,
            }}
          })}
        >
          Abrir OS
        </button>
      )}
      extraFilters={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {/* Status badge filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterStatus('')}
              style={{
                padding: '3px 12px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer',
                border: filterStatus === '' ? '2px solid #60a5fa' : '2px solid transparent',
                background: filterStatus === '' ? '#1e3a5f' : '#2a2d3a',
                color: filterStatus === '' ? '#93c5fd' : '#9ca3af',
                transition: 'all 0.15s',
              }}
            >Todos</button>
            {STATUS_OPTIONS.map(opt => {
              const color = STATUS_COLORS[opt.value] ?? '#6b7280'
              const active = String(filterStatus) === String(opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilterStatus(active ? '' : String(opt.value))}
                  style={{
                    padding: '3px 12px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
                    cursor: 'pointer',
                    background: active ? color : '#2a2d3a',
                    color: active ? '#fff' : '#9ca3af',
                    border: active ? `2px solid ${color}` : '2px solid transparent',
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
              onChange={e => { const [y,m,d] = e.target.value.split('-'); setFromDisplay(`${d}/${m}/${y}`) }} />
            <button type="button" className="btn-calendar" onClick={() => fromPickerRef.current?.showPicker()}>📅</button>
          </div>
          <span style={{ color: '#aaa', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Até</span>
          <div className="date-picker-wrapper">
            <input
              type="text" value={toDisplay} placeholder="dd/mm/aaaa" maxLength={10}
              className="crud-search" style={{ width: '120px' }}
              onChange={e => setToDisplay(maskDate(e.target.value))}
            />
            <input type="date" ref={toPickerRef} className="hidden-date-picker"
              onChange={e => { const [y,m,d] = e.target.value.split('-'); setToDisplay(`${d}/${m}/${y}`) }} />
            <button type="button" className="btn-calendar" onClick={() => toPickerRef.current?.showPicker()}>📅</button>
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={() => { setFilterStatus(''); setFromDisplay(''); setToDisplay('') }}
              style={{ padding: '5px 10px', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid #555', borderRadius: 4, background: '#1a1a1a', color: '#aaa' }}
            >
              Limpar
            </button>
          )}
          </div>
        </div>
      }
    />
  )
}
