import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllOperationalCosts,
  createOperationalCost,
  updateOperationalCost,
  deleteOperationalCost,
  fetchAllCostCategory,
  createCostCategory,
  fetchAllServiceOrder,
} from '../api'

const RECURRENCE_LABELS = {
  1: 'Diário',
  7: 'Semanal',
  15: 'Quinzenal',
  30: 'Mensal',
  90: 'Trimestral',
  180: 'Semestral',
  365: 'Anual',
}

const FIELDS = [
  { key: 'description', label: 'Descrição' },
  {
    key: 'amount',
    label: 'Valor',
    render: val =>
      val != null
        ? Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—',
  },
  {
    key: 'recurrence',
    label: 'Recorrência',
    render: val =>
      val != null
        ? RECURRENCE_LABELS[val] ?? `${val} dias`
        : '—',
  },
]

const CATEGORY_TYPES = { 1: 'Fixo', 2: 'Variável' }

function NewCategoryModal({ onSaved, onClose }) {
  const [form, setForm] = useState({ name: '', type: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    e.stopPropagation()
    setSaving(true)
    setError(null)
    try {
      const created = await createCostCategory({
        name: form.name || null,
        type: form.type !== '' ? Number(form.type) : null,
        description: form.description || null,
      })
      onSaved(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="form-modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="form-modal" style={{ width: '420px' }}>
        <div className="form-modal-header">
          <span>Nova Categoria</span>
          <button className="modal-close" type="button" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit} className="crud-form" style={{ padding: 0, boxShadow: 'none' }}>
            <div className="form-group">
              <label>Nome *</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} required autoFocus />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select name="type" value={form.type} onChange={handleChange}>
                <option value="">— Selecione —</option>
                {Object.entries(CATEGORY_TYPES).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <input type="text" name="description" value={form.description} onChange={handleChange} />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button type="submit" className="btn-novo" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={onClose}>Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )
}

function orderLabel(order) {
  return `#${order.id_order} — ${order.customer_name ?? ''}${order.plate_number ? ` | ${order.plate_number}` : ''}`
}

function ServiceOrderAutocomplete({ value, onChange, orders }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Sync display text when value or orders change (e.g. on edit load)
  useEffect(() => {
    if (value && orders.length) {
      const found = orders.find(o => o.id_order === Number(value))
      if (found) setQuery(orderLabel(found))
    }
    if (!value) setQuery('')
  }, [value, orders])

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
    const matches = orders.filter(o =>
      String(o.id_order).includes(q) ||
      (o.customer_name ?? '').toLowerCase().includes(lower) ||
      (o.plate_number ?? '').toLowerCase().includes(lower)
    )
    setSuggestions(matches.slice(0, 10))
    setOpen(true)
  }

  function handleSelect(order) {
    setQuery(orderLabel(order))
    setSuggestions([])
    setOpen(false)
    onChange(order.id_order)
  }

  function handleClear() {
    setQuery('')
    setSuggestions([])
    setOpen(false)
    onChange('')
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Digite o nº da OS, cliente ou placa..."
          autoComplete="off"
          style={{ flex: 1 }}
        />
        {query && (
          <button type="button" onClick={handleClear} style={{ padding: '0 10px' }}>
            ✕
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute',
          zIndex: 999,
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '4px',
          margin: 0,
          padding: 0,
          listStyle: 'none',
          width: '100%',
          maxHeight: '220px',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {suggestions.map(order => (
            <li
              key={order.id_order}
              onMouseDown={() => handleSelect(order)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #2a2a2a',
                fontSize: '0.9rem',
                color: '#eee',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: '#f5c800', fontWeight: 600 }}>#{order.id_order}</span>
              {' — '}
              {order.customer_name ?? ''}
              {order.plate_number && (
                <span style={{ color: '#aaa', marginLeft: '8px' }}>{order.plate_number}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function OperationalCostForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    id_cost_category: initialData?.id_cost_category ?? '',
    description: initialData?.description ?? '',
    amount: initialData?.amount ?? '',
    recurrence: initialData?.recurrence ?? '',
    reference_date: initialData?.reference_date ?? '',
    due_day: initialData?.due_day ?? '',
    id_order: initialData?.id_order ?? '',
  })
  const isMonthly = Number(form.recurrence) === 30
  const [categories, setCategories] = useState([])
  const [categoryError, setCategoryError] = useState(null)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [orders, setOrders] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllCostCategory()
      .then(setCategories)
      .catch(err => { setCategoryError(err.message); setCategories([]) })
    fetchAllServiceOrder().then(setOrders).catch(() => setOrders([]))
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      id_cost_category: form.id_cost_category !== '' ? Number(form.id_cost_category) : null,
      description: form.description || null,
      amount: form.amount !== '' ? Number(form.amount) : null,
      recurrence: form.recurrence !== '' ? Number(form.recurrence) : null,
      reference_date: isMonthly ? null : (form.reference_date || null),
      due_day: isMonthly ? (form.due_day !== '' ? Number(form.due_day) : null) : null,
      id_order: form.id_order !== '' ? Number(form.id_order) : null,
    }

    try {
      if (isEdit) {
        await updateOperationalCost(initialData.id_cost, payload)
      } else {
        await createOperationalCost(payload)
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

      {/* Linha 1: Categoria + Descrição + Valor */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Categoria</label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select name="id_cost_category" value={form.id_cost_category} onChange={handleChange} style={{ flex: 1 }}>
              <option value="">— Selecione —</option>
              {categories.map(cat => (
                <option key={cat.id_cost_category} value={cat.id_cost_category}>
                  {cat.name ?? `Categoria #${cat.id_cost_category}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewCategory(true)}
              title="Nova categoria"
              style={{
                width: '34px', height: '34px', flexShrink: 0,
                background: '#e60000', color: '#fff', border: 'none',
                borderRadius: '4px', fontSize: '1.3rem', lineHeight: 1,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >+</button>
          </div>
          {categoryError && <p className="error" style={{fontSize:'0.8rem',marginTop:'4px'}}>Erro ao carregar categorias: {categoryError}</p>}
        </div>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Descrição</label>
          <input
            type="text"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Ex: Aluguel, Energia elétrica..."
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Valor (R$)</label>
          <input
            type="number"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
            min="0"
            step="0.01"
            placeholder="0,00"
          />
        </div>
      </div>

      {showNewCategory && (
        <NewCategoryModal
          onClose={() => setShowNewCategory(false)}
          onSaved={created => {
            setCategories(prev => [...prev, created].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
            setForm(prev => ({ ...prev, id_cost_category: created.id_cost_category }))
            setShowNewCategory(false)
          }}
        />
      )}

      {/* Linha 2: Recorrência + Dia de Vencimento ou Data de Referência */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Recorrência</label>
          <select name="recurrence" value={form.recurrence} onChange={handleChange}>
            <option value="">— Selecione —</option>
            {Object.entries(RECURRENCE_LABELS).map(([days, label]) => (
              <option key={days} value={days}>{label}</option>
            ))}
            <option value="0">Único (sem recorrência)</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          {isMonthly ? (
            <>
              <label>Dia de Vencimento</label>
              <input
                type="number"
                name="due_day"
                value={form.due_day}
                onChange={handleChange}
                min="1" max="31"
                placeholder="Ex: 10"
                onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              />
            </>
          ) : (
            <>
              <label>Data de Referência</label>
              <input
                type="date"
                name="reference_date"
                value={form.reference_date ?? ''}
                onChange={handleChange}
              />
            </>
          )}
        </div>
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

export const { NewPage: OperationalCostNewPage, EditPage: OperationalCostEditPage } =
  makeFormPages(OperationalCostForm, 'Custos Operacionais', '/financeiro/operacao')

function fmtDate(val) {
  if (!val) return '—'
  // val pode vir como "2026-06-11" ou "2026-06-11T00:00:00Z"
  const d = val.substring(0, 10)
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function CostsPanel({ title, items, onEdit, onDelete, fmtAmount, showReferenceDate = false }) {
  const total = items.reduce((acc, c) => acc + Number(c.amount ?? 0), 0)

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{
        background: '#1a1a1a', borderRadius: '8px 8px 0 0',
        padding: '10px 16px', fontWeight: 700, fontSize: '0.9rem',
        color: '#f5c800', borderBottom: '1px solid #2a2a2a',
      }}>
        {title} <span style={{ color: '#888', fontWeight: 400, fontSize: '0.8rem' }}>({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div style={{ background: '#111', padding: '16px', color: '#666', fontSize: '0.85rem', borderRadius: '0 0 8px 8px' }}>
          Nenhum registro.
        </div>
      ) : (
        <table style={{ borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Valor</th>
              {showReferenceDate
                ? <th>Data</th>
                : <th>Recorrência</th>
              }
              <th className="actions-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id_cost}>
                <td>{c.description ?? '—'}</td>
                <td>{fmtAmount(c.amount)}</td>
                {showReferenceDate
                  ? <td>{fmtDate(c.reference_date)}</td>
                  : <td>{c.recurrence != null ? [RECURRENCE_LABELS[c.recurrence] ?? `${c.recurrence} dias`, c.due_day ? `todo dia ${c.due_day}` : null].filter(Boolean).join(' ') : '—'}</td>
                }
                <td className="actions-col">
                  <button className="btn-edit" onClick={() => onEdit(c)}>Editar</button>
                  <button className="btn-delete" onClick={() => onDelete(c)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1a1a1a', fontWeight: 700 }}>
              <td colSpan={2} style={{ textAlign: 'right', color: '#aaa', paddingRight: '12px' }}>
                Total: <span style={{ color: '#eee' }}>{fmtAmount(total)}</span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      )}
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

function isoToBRShort(iso) {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// Verifica se um custo recorrente possui alguma ocorrência dentro do período [start, end]
// start e end são strings "YYYY-MM-DD"
function recurrenteNoPeriodo(item, start, end) {
  const recurrence = Number(item.recurrence)
  const startDate  = new Date(start + 'T00:00:00')
  const endDate    = new Date(end   + 'T00:00:00')

  if (recurrence === 30) {
    // Mensal com due_day: verifica se o dia de vencimento cai em algum mês do período
    const dueDay = item.due_day
    if (!dueDay) return true
    let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    while (cur <= endDate) {
      const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
      const actualDay   = Math.min(dueDay, daysInMonth)
      const occurrence  = new Date(cur.getFullYear(), cur.getMonth(), actualDay)
      if (occurrence >= startDate && occurrence <= endDate) return true
      cur.setMonth(cur.getMonth() + 1)
    }
    return false
  }

  if (recurrence === 1) return true // diário: sempre ocorre

  // Para recorrências com intervalo fixo, usa reference_date como ponto de partida
  if (!item.reference_date) return true
  const refDate = new Date(item.reference_date.substring(0, 10) + 'T00:00:00')

  // Calcula quantos intervalos são necessários para atingir ou passar o início do período
  const msPerDay  = 86400000
  const diffDays  = Math.ceil((startDate - refDate) / msPerDay)
  const startN    = diffDays > 0 ? Math.ceil(diffDays / recurrence) : 0
  const firstHit  = new Date(refDate.getTime() + startN * recurrence * msPerDay)
  return firstHit <= endDate
}

export default function OperationalCostsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Filtro de período — mês atual como padrão
  const today   = new Date()
  const yyyy    = today.getFullYear()
  const mm      = String(today.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(yyyy, today.getMonth() + 1, 0).getDate()
  const defaultStart = `${yyyy}-${mm}-01`
  const defaultEnd   = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`

  const [fromDisplay, setFromDisplay] = useState(isoToBRShort(defaultStart))
  const [toDisplay,   setToDisplay]   = useState(isoToBRShort(defaultEnd))
  const fromPickerRef = useRef(null)
  const toPickerRef   = useRef(null)

  const filterStart = brToISO(fromDisplay)
  const filterEnd   = brToISO(toDisplay)

  const fmtAmount = val => Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchAllOperationalCosts())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleEdit(item) {
    navigate('/financeiro/operacao/edit', { state: { item } })
  }

  async function handleDelete(item) {
    if (!window.confirm('Excluir este custo?')) return
    setDeleting(true)
    try {
      await deleteOperationalCost(item.id_cost)
      await load()
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  // Separa em recorrentes e eventuais, aplicando filtro de período
  const allRecorrentes = items.filter(c => c.recurrence != null && Number(c.recurrence) !== 0)
  const allEventuais   = items.filter(c => c.recurrence == null || Number(c.recurrence) === 0)

  const recorrentes = (filterStart && filterEnd)
    ? allRecorrentes.filter(c => recurrenteNoPeriodo(c, filterStart, filterEnd))
    : allRecorrentes

  const eventuais = (filterStart && filterEnd)
    ? allEventuais.filter(c => {
        if (!c.reference_date) return true
        const d = c.reference_date.substring(0, 10)
        return d >= filterStart && d <= filterEnd
      })
    : allEventuais

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>💸 Custos Operacionais</h2>
        <button className="btn-novo" onClick={() => navigate('/financeiro/operacao/new')}>+ Novo</button>
      </div>

      {/* Filtro de período */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span style={{ color: '#aaa', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>De</span>
        <div className="date-picker-wrapper">
          <input
            type="text" value={fromDisplay} placeholder="dd/mm/aaaa" maxLength={10}
            className="crud-search" style={{ width: '120px' }}
            onChange={e => setFromDisplay(maskDate(e.target.value))}
          />
          <input type="date" ref={fromPickerRef} className="hidden-date-picker"
            onChange={e => setFromDisplay(isoToBRShort(e.target.value))} />
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
            onChange={e => setToDisplay(isoToBRShort(e.target.value))} />
          <button type="button" className="btn-calendar"
            onClick={() => toPickerRef.current?.showPicker()}>📅</button>
        </div>
        {(filterStart || filterEnd) && (
          <button type="button"
            onClick={() => { setFromDisplay(''); setToDisplay('') }}
            style={{ padding: '5px 10px', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid #555', borderRadius: 4, background: '#1a1a1a', color: '#aaa' }}
          >Limpar</button>
        )}
      </div>

      {loading && <p className="loading">Carregando...</p>}
      {error   && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <CostsPanel
            title="Recorrentes"
            items={recorrentes}
            onEdit={handleEdit}
            onDelete={handleDelete}
            fmtAmount={fmtAmount}
          />
          <CostsPanel
            title="Eventuais"
            items={eventuais}
            onEdit={handleEdit}
            onDelete={handleDelete}
            fmtAmount={fmtAmount}
            showReferenceDate
          />

          {/* Total geral do período */}
          {(() => {
            const totalGeral =
              recorrentes.reduce((acc, c) => acc + Number(c.amount ?? 0), 0) +
              eventuais.reduce((acc, c) => acc + Number(c.amount ?? 0), 0)
            return (
              <div style={{
                display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                gap: '12px', padding: '14px 20px',
                background: '#1a1a1a', borderRadius: '8px',
                border: '1px solid #2a2a2a',
              }}>
                <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
                  Custo total para manter a operação no período:
                </span>
                <span style={{ color: '#f5c800', fontWeight: 700, fontSize: '1.1rem' }}>
                  {fmtAmount(totalGeral)}
                </span>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
