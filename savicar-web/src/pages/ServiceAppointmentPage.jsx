import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { makeFormPages } from '../components/CrudFormPage'
import { loadFilters, saveFilters } from '../filterStorage'
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
import { serverNow } from '../serverClock'

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
  const pickerRef = useRef(null)
  function handleChange(e) {
    const masked = maskDatetime(e.target.value)
    setDisplay(masked)
    onChange(displayToISO(masked))
  }
  function handlePicker(e) {
    if (!e.target.value) return
    const iso = e.target.value.replace('T', ' ') + ':00'
    setDisplay(isoToDisplay(iso))
    onChange(iso)
  }
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="date-picker-wrapper" style={{ width: 'fit-content' }}>
        <input type="text" value={display} onChange={handleChange} placeholder="dd/mm/aaaa hh:mm" maxLength={16} style={{ width: '150px', flex: 'none' }} />
        <input type="datetime-local" ref={pickerRef} className="hidden-date-picker" onChange={handlePicker} />
        <button type="button" className="btn-calendar" onClick={() => pickerRef.current?.showPicker()}>📅</button>
      </div>
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

// ── Draft persistence for the "new appointment" form ──────────
// Lets a user navigate away mid-fill and resume later, since the
// form lives on its own route (/appointments/new) that unmounts
// (and loses all state) whenever the user leaves it.
const APPOINTMENT_DRAFT_KEY = 'draft:/appointments/new'

function loadAppointmentDraft() {
  try {
    const raw = sessionStorage.getItem(APPOINTMENT_DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveAppointmentDraft(data) {
  try {
    sessionStorage.setItem(APPOINTMENT_DRAFT_KEY, JSON.stringify(data))
  } catch {
    // ignore storage errors (private browsing quota, etc.)
  }
}

export function clearAppointmentDraft() {
  try {
    sessionStorage.removeItem(APPOINTMENT_DRAFT_KEY)
  } catch {
    // ignore
  }
}

// ── Form ──────────────────────────────────────────────────────
export function ServiceAppointmentForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData?.id_service_appointment
  const draft = isEdit || initialData ? null : loadAppointmentDraft()

  const [startAt,         setStartAt]         = useState(() => draft?.startAt ?? normalizeForDB(initialData?.start_at))
  const [endAt,           setEndAt]           = useState(() => draft?.endAt ?? normalizeForDB(initialData?.end_at))
  const [status,          setStatus]          = useState(draft?.status ?? initialData?.status ?? (isEdit ? '' : 1))
  const [notes,           setNotes]           = useState(draft?.notes ?? initialData?.notes ?? '')
  const [idCustomerModel, setIdCustomerModel] = useState(draft?.idCustomerModel ?? initialData?.id_customer_model ?? '')
  const [idCustomer,      setIdCustomer]      = useState(draft?.idCustomer ?? '')

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
  const [appointmentResources, setAppointmentResources] = useState(() => draft?.appointmentResources ?? [])
  const [editingRes,   setEditingRes]   = useState(null)
  const [resForm,      setResForm]      = useState(emptyResForm)
  const [resSaving,    setResSaving]    = useState(false)
  const [resError,     setResError]     = useState(null)

  useEffect(() => {
    if (isEdit) return
    saveAppointmentDraft({ startAt, endAt, status, notes, idCustomerModel, idCustomer, appointmentResources })
  }, [isEdit, startAt, endAt, status, notes, idCustomerModel, idCustomer, appointmentResources])

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
      if (!isEdit) clearAppointmentDraft()
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (!isEdit) clearAppointmentDraft()
    onCancel()
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

        {editingRes !== null && createPortal(
          <div className="form-modal-overlay" onClick={() => setEditingRes(null)}>
            <div className="form-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className="form-modal-header">
                <span>{editingRes.id_service_appointment_resource ? 'Editar Recurso' : 'Novo Recurso'}{initialData?.id_service_appointment ? ` — Agendamento #${initialData.id_service_appointment}` : ''}</span>
                <button className="modal-close" onClick={() => setEditingRes(null)}>✕</button>
              </div>
              <div style={{ padding: '1rem' }}>
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
            </div>
          </div>,
          document.body
        )}
      </div>

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" onClick={handleCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: ServiceAppointmentNewPage, EditPage: ServiceAppointmentEditPage } =
  makeFormPages(ServiceAppointmentForm, 'Agendamentos', '/appointments')

// ── Weekly calendar list ──────────────────────────────────────
const HOUR_H = 56
const DEFAULT_START_H = 7
const DEFAULT_END_H = 19
const WEEKDAYS = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function pad2(n) { return String(n).padStart(2, '0') }

function parseLocal(val) {
  if (!val) return null
  const s = String(val)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return d ? new Date(+d[1], +d[2] - 1, +d[3], 0, 0) : null
}

function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - x.getDay())
  return x
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtHM(d) { return `${d.getHours()}:${pad2(d.getMinutes())}` }

function layoutDay(events) {
  const sorted = [...events].sort((a, b) => a.sMin - b.sMin || a.eMin - b.eMin)
  const out = []
  let cluster = []
  let clusterEnd = -1
  function flush() {
    const cols = []
    cluster.forEach(ev => {
      let c = cols.findIndex(end => end <= ev.sMin)
      if (c === -1) { c = cols.length; cols.push(ev.eMin) } else { cols[c] = ev.eMin }
      ev.col = c
    })
    cluster.forEach(ev => { ev.cols = cols.length })
    out.push(...cluster)
    cluster = []
  }
  sorted.forEach(ev => {
    if (cluster.length && ev.sMin >= clusterEnd) { flush(); clusterEnd = -1 }
    cluster.push(ev)
    clusterEnd = Math.max(clusterEnd, ev.eMin)
  })
  if (cluster.length) flush()
  return out
}

const APPOINTMENT_FILTERS_KEY = '/appointments:extra-filters'

export default function ServiceAppointmentPage() {
  const navigate = useNavigate()
  const savedFilters = loadFilters(APPOINTMENT_FILTERS_KEY, { filterStatus: '', search: '' })
  const [filterStatus, setFilterStatus] = useState(savedFilters.filterStatus ?? '')
  const [search, setSearch] = useState(savedFilters.search ?? '')
  const [resumingDraft] = useState(() => !!loadAppointmentDraft())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(serverNow()))
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [selected, setSelected] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    if (resumingDraft) navigate('/appointments/new', { replace: true })
  }, [])

  useEffect(() => {
    saveFilters(APPOINTMENT_FILTERS_KEY, { filterStatus, search })
  }, [filterStatus, search])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems((await fetchAllServiceAppointment()) ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (resumingDraft) return null

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = addDays(weekStart, 7)
  const q = search.trim().toLowerCase()

  const appts = items
    .map(item => {
      const start = parseLocal(item.start_at)
      if (!start) return null
      let end = parseLocal(item.end_at)
      if (!end || end <= start) end = new Date(start.getTime() + 60 * 60000)
      const sMin = start.getHours() * 60 + start.getMinutes()
      const eMin = sameDay(start, end) ? Math.max(end.getHours() * 60 + end.getMinutes(), sMin + 30) : 1440
      return { item, start, end, sMin, eMin }
    })
    .filter(Boolean)
    .filter(a => a.start >= weekStart && a.start < weekEnd)
    .filter(a => !filterStatus || String(a.item.status) === filterStatus)
    .filter(a => !q || [a.item.customer_name, a.item.plate_number, a.item.model_name].join(' ').toLowerCase().includes(q))

  const minH = Math.min(DEFAULT_START_H, ...appts.map(a => Math.floor(a.sMin / 60)))
  const maxH = Math.max(DEFAULT_END_H, ...appts.map(a => Math.ceil(a.eMin / 60)))
  const totalH = maxH - minH
  const hours = Array.from({ length: totalH }, (_, i) => minH + i)

  const first = weekDays[0]
  const last = weekDays[6]
  const rangeLabel = `${first.getDate()} ${MONTHS[first.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`
  const today = serverNow()

  function showTooltip(e, a) {
    const r = e.currentTarget.getBoundingClientRect()
    const flip = r.right + 280 > window.innerWidth
    setTooltip({ a, x: flip ? r.left - 8 : r.right + 8, y: r.top, flip })
  }

  function newAtSlot(e, day) {
    const rect = e.currentTarget.getBoundingClientRect()
    const slot = Math.floor(((e.clientY - rect.top) / HOUR_H) * 2)
    const startMin = minH * 60 + slot * 30
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, startMin)
    const end = new Date(start.getTime() + 60 * 60000)
    const fmt = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`
    navigate('/appointments/new', { state: { initialData: { start_at: fmt(start), end_at: fmt(end) } } })
  }

  function openOS(item) {
    navigate('/service-orders/new', {
      state: { initialData: {
        id_customer:           item.id_customer,
        id_customer_model:     item.id_customer_model,
        estimated_delivery_at: item.end_at,
      }},
    })
  }

  async function handleDelete(item) {
    if (!window.confirm('Deseja excluir este agendamento?')) return
    setDeleting(true)
    try {
      await deleteServiceAppointment(item.id_service_appointment)
      setSelected(null)
      await load()
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>📅 Agendamentos</h2>
        <button className="btn-novo" onClick={() => navigate('/appointments/new')}>+ Novo Agendamento</button>
      </div>

      <div className="crud-filters" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
        <input
          className="crud-search"
          type="text"
          placeholder="Filtrar por cliente ou placa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
      </div>

      <div className="cal-nav">
        <button type="button" className="cal-nav-btn" onClick={() => setWeekStart(w => addDays(w, -7))} title="Semana anterior">‹</button>
        <button type="button" className="cal-nav-btn" onClick={() => setWeekStart(startOfWeek(serverNow()))}>Hoje</button>
        <button type="button" className="cal-nav-btn" onClick={() => setWeekStart(w => addDays(w, 7))} title="Próxima semana">›</button>
        <span className="cal-range">{rangeLabel}</span>
        <div className="date-picker-wrapper">
          <input type="date" ref={pickerRef} className="hidden-date-picker"
            onChange={e => {
              if (!e.target.value) return
              const [y, m, d] = e.target.value.split('-').map(Number)
              setWeekStart(startOfWeek(new Date(y, m - 1, d)))
            }} />
          <button type="button" className="btn-calendar" title="Ir para a semana de uma data" onClick={() => pickerRef.current?.showPicker()}>📅</button>
        </div>
      </div>

      {loading && <p className="loading">Carregando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="cal-wrap">
          <div className="cal-grid">
            <div className="cal-corner" />
            {weekDays.map((d, i) => (
              <div key={i} className={`cal-dayhead${sameDay(d, today) ? ' today' : ''}`}>
                <span className="cal-dow">{WEEKDAYS[d.getDay()]}</span>
                <span className="cal-dnum">{d.getDate()}</span>
              </div>
            ))}

            <div className="cal-times" style={{ height: totalH * HOUR_H }}>
              {hours.map(h => (
                <span key={h} className="cal-hour" style={{ top: (h - minH) * HOUR_H }}>
                  {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
                </span>
              ))}
            </div>

            {weekDays.map((d, i) => {
              const dayEvents = layoutDay(appts.filter(a => sameDay(a.start, d)))
              return (
                <div
                  key={i}
                  className={`cal-day${d.getDay() === 0 ? ' weekend' : ''}${sameDay(d, today) ? ' today' : ''}`}
                  style={{ height: totalH * HOUR_H, '--hh': `${HOUR_H}px` }}
                  onClick={e => newAtSlot(e, d)}
                >
                  {dayEvents.map(ev => {
                    const color = STATUS_COLORS[ev.item.status] ?? '#6b7280'
                    const top = ((ev.sMin - minH * 60) / 60) * HOUR_H
                    const height = Math.max(((ev.eMin - ev.sMin) / 60) * HOUR_H - 2, 22)
                    return (
                      <div
                        key={ev.item.id_service_appointment}
                        className="cal-card"
                        style={{
                          top, height,
                          left: `calc(${(ev.col / ev.cols) * 100}% + 2px)`,
                          width: `calc(${100 / ev.cols}% - 4px)`,
                          background: color + '2b',
                          borderLeft: `3px solid ${color}`,
                          color,
                        }}
                        onMouseEnter={e => showTooltip(e, ev)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={e => { e.stopPropagation(); setTooltip(null); setSelected(ev.item) }}
                      >
                        <span className="cal-card-time">{fmtHM(ev.start)}-{fmtHM(ev.end)}</span>
                        <strong className="cal-card-name">{ev.item.customer_name ?? '—'}</strong>
                        <span className="cal-card-sub">{[ev.item.model_name, ev.item.plate_number].filter(Boolean).join(' · ')}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && !error && appts.length === 0 && (
        <p className="crud-counter" style={{ marginTop: 12 }}>Nenhum agendamento nesta semana.</p>
      )}

      {tooltip && createPortal(
        <div
          className="cal-tooltip"
          style={{ top: tooltip.y, left: tooltip.x, transform: tooltip.flip ? 'translateX(-100%)' : 'none' }}
        >
          <strong>{tooltip.a.item.customer_name ?? '—'}</strong>
          <div>{[tooltip.a.item.model_name, tooltip.a.item.plate_number].filter(Boolean).join(' · ') || '—'}</div>
          <div>{fmtHM(tooltip.a.start)}-{fmtHM(tooltip.a.end)} · {STATUS_LABELS[tooltip.a.item.status] ?? ''}</div>
          {tooltip.a.item.notes && <div>{tooltip.a.item.notes}</div>}
        </div>,
        document.body
      )}

      {selected && createPortal(
        <div className="form-modal-overlay" onClick={() => setSelected(null)}>
          <div className="form-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="form-modal-header">
              <span>Agendamento #{selected.id_service_appointment}</span>
              <button className="modal-close" type="button" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="crud-form" style={{ gap: 8 }}>
              <div><strong>Cliente:</strong> {selected.customer_name ?? '—'}</div>
              <div><strong>Veículo:</strong> {[selected.model_name, selected.plate_number].filter(Boolean).join(' · ') || '—'}</div>
              <div><strong>Início:</strong> {fmtDatetimeBR(selected.start_at)}</div>
              <div><strong>Fim:</strong> {fmtDatetimeBR(selected.end_at) || '—'}</div>
              <div><strong>Status:</strong> <StatusBadge status={selected.status} /></div>
              {selected.notes && <div><strong>Observações:</strong> {selected.notes}</div>}
              <div className="form-actions">
                <button className="btn-edit" type="button" onClick={() => navigate('/appointments/edit', { state: { item: selected } })}>Editar</button>
                <button className="btn-os" type="button" onClick={() => openOS(selected)}>Abrir OS</button>
                <button className="btn-delete" type="button" disabled={deleting} onClick={() => handleDelete(selected)}>{deleting ? 'Excluindo...' : 'Excluir'}</button>
                <button type="button" onClick={() => setSelected(null)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
