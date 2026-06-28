import { useState, useEffect, useRef } from 'react'
import { fetchAllPayments, fetchAllServiceOrder, fetchAllPaymentMethod, updatePayment } from '../api'

const PAGE_SIZE = 10

function normalize(str) {
  return String(str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function isoToBR(iso) {
  if (!iso) return ''
  const parts = iso.slice(0, 10).split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ''
}

function brToIso(br) {
  if (!br) return ''
  const parts = br.split('/')
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : ''
}

function maskDate(val) {
  const d = val.replace(/\D/g, '').slice(0, 8)
  let r = d
  if (d.length > 2) r = d.slice(0, 2) + '/' + d.slice(2)
  if (d.length > 4) r = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4)
  return r
}

function getStatus(p, today) {
  if (p.payment_date) return 'Pago'
  if (p.due_date && p.due_date < today) return 'Vencido'
  return 'Pendente'
}

const STATUS_COLOR = {
  Pago:     '#27ae60',
  Pendente: '#f5c800',
  Vencido:  '#e53935',
}

const STATUS_META = [
  {
    key:   'Pago',
    label: 'Recebido',
    color: '#27ae60',
    bg:    '#0d2b1a',
    icon:  '✓',
  },
  {
    key:   'Pendente',
    label: 'A Vencer',
    color: '#f5c800',
    bg:    '#2a2200',
    icon:  '🕐',
  },
  {
    key:   'Vencido',
    label: 'Em Atraso',
    color: '#e53935',
    bg:    '#2b0d0d',
    icon:  '!',
  },
]

/* ── Summary chart ──────────────────────────────────────────── */
function SummaryChart({ summary, fmt, filterStatuses, onToggleStatus }) {
  const maxVal = Math.max(...STATUS_META.map(m => summary[m.key].total), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxWidth: '560px' }}>
      {STATUS_META.filter(meta => filterStatuses.has(meta.key)).map((meta) => {
        const { key, label, color, bg, icon } = meta
        const val = summary[key].total
        const count = summary[key].count
        const pct = (val / maxVal) * 100
        const isActive = filterStatuses.has(key)

        return (
          <div
            key={key}
            onClick={() => onToggleStatus(key)}
            style={{
              background: '#13181f',
              borderRadius: '12px',
              padding: '18px 20px 14px',
              marginBottom: '12px',
              cursor: 'pointer',
              border: `1.5px solid ${isActive ? color : 'transparent'}`,
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '14px' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: bg, border: `1.5px solid ${color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', color, fontWeight: 900, flexShrink: 0,
                userSelect: 'none',
              }}>
                {icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#8a9bb0', fontSize: '0.85rem', marginBottom: '4px' }}>{label}</div>
                <div style={{ color: '#ffffff', fontSize: '1.9rem', fontWeight: 700, lineHeight: 1 }}>
                  {fmt(val)}
                </div>
                <div style={{ color: '#4a5568', fontSize: '0.75rem', marginTop: '4px' }}>
                  {count} registro{count !== 1 ? 's' : ''} {isActive ? '▲' : '▼'}
                </div>
              </div>
            </div>
            <div style={{ height: '4px', background: '#1e2533', borderRadius: '2px' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: color, borderRadius: '2px',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function RelatorioPagamentosPage() {
  const [payments, setPayments] = useState([])
  const [orderMap, setOrderMap] = useState({})
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterOS, setFilterOS] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterStatuses, setFilterStatuses] = useState(new Set(['Pago', 'Pendente', 'Vencido']))
  const [currentPage, setCurrentPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [dueDateDisplay, setDueDateDisplay] = useState('')
  const [paymentDateDisplay, setPaymentDateDisplay] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [view, setView] = useState('resumo') // 'resumo' | 'detalhes'

  const defaultDateTo = new Date().toISOString().slice(0, 10)
  const defaultDateFrom = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })()
  const [filterDateFrom, setFilterDateFrom] = useState(defaultDateFrom)
  const [filterDateTo, setFilterDateTo] = useState(defaultDateTo)
  const [filterDateFromDisplay, setFilterDateFromDisplay] = useState(isoToBR(defaultDateFrom))
  const [filterDateToDisplay, setFilterDateToDisplay] = useState(isoToBR(defaultDateTo))
  const pickerFromRef = useRef(null)
  const pickerToRef = useRef(null)

  useEffect(() => {
    Promise.all([fetchAllPayments(), fetchAllServiceOrder(), fetchAllPaymentMethod()])
      .then(([pmts, orders, methods]) => {
        setPayments(pmts ?? [])
        const map = {}
        for (const o of (orders ?? [])) map[o.id_order] = o.customer_name ?? ''
        setOrderMap(map)
        setPaymentMethods(methods ?? [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = payments.filter(p => {
    if (filterOS && !String(p.id_order ?? '').includes(filterOS.trim())) return false
    if (filterCustomer && !normalize(orderMap[p.id_order] ?? '').includes(normalize(filterCustomer))) return false
    const dateRef = (p.due_date ?? '').slice(0, 10)
    if (filterDateFrom && dateRef && dateRef < filterDateFrom) return false
    if (filterDateTo && dateRef && dateRef > filterDateTo) return false
    if (!filterStatuses.has(getStatus(p, today))) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const fmt = v => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const summary = filtered.reduce(
    (acc, p) => {
      const status = getStatus(p, today)
      const val = Number(p.value ?? 0)
      acc[status].count += 1
      acc[status].total += val
      return acc
    },
    { Pago: { count: 0, total: 0 }, Pendente: { count: 0, total: 0 }, Vencido: { count: 0, total: 0 } }
  )

  function resetPage() { setCurrentPage(1) }

  function openDetail(p) {
    setSelected({ ...p, customerName: orderMap[p.id_order] ?? '' })
    setEditing(false)
    setSaveError(null)
  }

  function closeModal() {
    setSelected(null)
    setEditing(false)
    setSaveError(null)
  }

  function startEdit() {
    const dueIso = selected.due_date ? selected.due_date.slice(0, 10) : ''
    const paidIso = selected.payment_date ? selected.payment_date.slice(0, 10) : ''
    setEditForm({
      id_payment_method: selected.id_payment_method ?? '',
      due_date: dueIso,
      payment_date: paidIso,
      value: selected.value ?? '',
      installments_quantity: selected.installments_quantity ?? '',
    })
    setDueDateDisplay(isoToBR(dueIso))
    setPaymentDateDisplay(isoToBR(paidIso))
    setSaveError(null)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        id_order: selected.id_order,
        id_payment_method: editForm.id_payment_method ? Number(editForm.id_payment_method) : null,
        due_date: editForm.due_date || null,
        payment_date: editForm.payment_date || null,
        value: editForm.value !== '' ? Number(editForm.value) : null,
        installments_quantity: editForm.installments_quantity || null,
      }
      await updatePayment(selected.id_payment, payload)
      const method = paymentMethods.find(m => m.id_payment_method === Number(editForm.id_payment_method))
      const updated = {
        ...selected,
        id_payment_method: payload.id_payment_method,
        payment_method_description: method?.description ?? selected.payment_method_description,
        due_date: payload.due_date,
        payment_date: payload.payment_date,
        value: payload.value,
        installments_quantity: payload.installments_quantity,
      }
      setPayments(prev => prev.map(p => p.id_payment === selected.id_payment ? updated : p))
      const newStatus = getStatus(updated, today)
      setSelected({ ...updated, status: newStatus, customerName: selected.customerName })
      setEditing(false)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="crud-page">
      <div className="crud-toolbar relatorio-toolbar">
        <h2>💰 Painel Financeiro</h2>

      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #1e2533', marginBottom: '20px' }}>
        {['resumo', 'detalhes'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '8px 22px',
              background: 'none',
              border: 'none',
              borderBottom: view === v ? '2px solid #e60000' : '2px solid transparent',
              marginBottom: '-2px',
              color: view === v ? '#fff' : '#64748b',
              fontWeight: view === v ? 700 : 400,
              fontSize: '0.9rem',
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'color 0.15s',
            }}
          >
            {v === 'resumo' ? 'Resumo' : 'Detalhes'}
          </button>
        ))}
      </div>

      {/* Filters — shown in both views */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="crud-search relatorio-search-os" type="text" placeholder="OS..."
          value={filterOS} onChange={e => { setFilterOS(e.target.value); resetPage() }} style={{ width: '80px' }} />
        <input className="crud-search" type="text" placeholder="Cliente..."
          value={filterCustomer} onChange={e => { setFilterCustomer(e.target.value); resetPage() }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
          <input type="text" className="crud-search" value={filterDateFromDisplay}
            placeholder="dd/mm/aaaa" maxLength={10}
            onChange={e => {
              const m = maskDate(e.target.value)
              setFilterDateFromDisplay(m)
              if (m.length === 10) { setFilterDateFrom(brToIso(m)); resetPage() }
              else setFilterDateFrom('')
            }}
            style={{ width: '110px' }} />
          <button type="button" onClick={() => pickerFromRef.current?.showPicker()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1rem', padding: '0 2px' }}
            title="Selecionar data">📅</button>
          <input type="date" ref={pickerFromRef} value={filterDateFrom}
            onChange={e => {
              const iso = e.target.value
              setFilterDateFrom(iso)
              setFilterDateFromDisplay(isoToBR(iso))
              resetPage()
            }}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
          <input type="text" className="crud-search" value={filterDateToDisplay}
            placeholder="dd/mm/aaaa" maxLength={10}
            onChange={e => {
              const m = maskDate(e.target.value)
              setFilterDateToDisplay(m)
              if (m.length === 10) { setFilterDateTo(brToIso(m)); resetPage() }
              else setFilterDateTo('')
            }}
            style={{ width: '110px' }} />
          <button type="button" onClick={() => pickerToRef.current?.showPicker()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1rem', padding: '0 2px' }}
            title="Selecionar data">📅</button>
          <input type="date" ref={pickerToRef} value={filterDateTo}
            onChange={e => {
              const iso = e.target.value
              setFilterDateTo(iso)
              setFilterDateToDisplay(isoToBR(iso))
              resetPage()
            }}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
        </div>
        {STATUS_META.map(({ key, label, color, bg, icon }) => {
          const active = filterStatuses.has(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilterStatuses(prev => {
                  const next = new Set(prev)
                  active ? next.delete(key) : next.add(key)
                  return next
                })
                resetPage()
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
                background: active ? bg : 'transparent',
                border: `1.5px solid ${active ? color : '#2a3142'}`,
                color: active ? color : '#64748b',
                fontWeight: active ? 700 : 400,
                fontSize: '0.82rem',
                transition: 'all 0.15s',
              }}
            >
              {active && <span>{icon}</span>}
              {label}
              {active && (
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>✕</span>
              )}
            </button>
          )
        })}
      </div>

      {loading && <p className="loading">Carregando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          {/* ── RESUMO view ── */}
          {view === 'resumo' && (
            filtered.length === 0
              ? <p style={{ color: '#888' }}>Nenhum registro encontrado.</p>
              : <>
                  <SummaryChart
                    summary={summary}
                    fmt={fmt}
                    filterStatuses={filterStatuses}
                    onToggleStatus={key => {
                      setFilterStatuses(new Set([key]))
                      setView('detalhes')
                      resetPage()
                    }}
                  />
                </>
          )}

          {/* ── DETALHES view ── */}
          {view === 'detalhes' && (
            <>
              {/* Summary cards */}
              {filtered.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {STATUS_META.map(({ key, label, color, bg, icon }) => (
                    <div key={key} style={{
                      flex: 1, minWidth: '160px',
                      background: '#13181f', border: `1px solid ${color}44`,
                      borderRadius: '12px', padding: '16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '10px',
                          background: bg, border: `1.5px solid ${color}55`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.1rem', color, fontWeight: 900, flexShrink: 0,
                          userSelect: 'none',
                        }}>
                          {icon}
                        </div>
                        <div style={{ color, fontWeight: 700, fontSize: '0.85rem' }}>{label}</div>
                      </div>
                      <div style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 700 }}>{fmt(summary[key].total)}</div>
                      <div style={{ color: '#4a5568', fontSize: '0.75rem', marginTop: '4px' }}>
                        {summary[key].count} registro{summary[key].count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <table>
                <thead>
                  <tr>
                    <th>OS</th>
                    <th>Cliente</th>
                    <th>Forma Pagamento</th>
                    <th>Vencimento</th>
                    <th>Data Pagamento</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr><td colSpan={7}>Nenhum registro encontrado.</td></tr>
                  ) : (
                    visible.map(p => {
                      const status = getStatus(p, today)
                      return (
                        <tr key={p.id_payment} className="row-clickable" onClick={() => openDetail(p)}>
                          <td>{p.id_order ?? ''}</td>
                          <td>{orderMap[p.id_order] ?? ''}</td>
                          <td>{p.payment_method_description ?? ''}</td>
                          <td>{isoToBR(p.due_date)}</td>
                          <td>{isoToBR(p.payment_date)}</td>
                          <td>{p.value != null ? fmt(p.value) : ''}</td>
                          <td><span className={`payment-status payment-status-${status.toLowerCase()}`}>{status}</span></td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>

              <div className="crud-footer">
                {totalPages > 1 && (
                  <div className="crud-pagination">
                    <button onClick={() => setCurrentPage(1)} disabled={safePage === 1}>«</button>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
                    <span>{safePage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}>»</button>
                  </div>
                )}
                <span className="crud-counter">
                  {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
                  {filtered.length > 0 && ` — exibindo ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)}`}
                </span>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Detail / Edit modal ── */}
      {selected && (
        <div className="form-modal-overlay">
          <div className="form-modal detail-modal">
            <div className="form-modal-header">
              <span>{editing ? 'Editar Pagamento' : 'Detalhes do Pagamento'}</span>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {editing ? (
              <div className="crud-form">
                <div className="form-group">
                  <label>Forma de Pagamento</label>
                  <select value={editForm.id_payment_method}
                    onChange={e => setEditForm(f => ({ ...f, id_payment_method: e.target.value }))}>
                    <option value="">— selecione —</option>
                    {paymentMethods.map(m => (
                      <option key={m.id_payment_method} value={m.id_payment_method}>{m.description}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Vencimento</label>
                  <input type="text" value={dueDateDisplay} placeholder="dd/mm/aaaa" maxLength={10}
                    onChange={e => { const m = maskDate(e.target.value); setDueDateDisplay(m); setEditForm(f => ({ ...f, due_date: brToIso(m) })) }} />
                </div>
                <div className="form-group">
                  <label>Data de Pagamento</label>
                  <input type="text" value={paymentDateDisplay} placeholder="dd/mm/aaaa" maxLength={10}
                    onChange={e => { const m = maskDate(e.target.value); setPaymentDateDisplay(m); setEditForm(f => ({ ...f, payment_date: brToIso(m) })) }} />
                </div>
                <div className="form-group">
                  <label>Valor</label>
                  <input type="number" step="0.01" value={editForm.value}
                    onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} />
                </div>
                {saveError && <p className="error">{saveError}</p>}
                <div className="form-actions">
                  <button type="button" className="btn-novo" onClick={handleSave} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="detail-body">
                  {[
                    ['OS',                 selected.id_order ?? '—'],
                    ['Cliente',            selected.customerName || '—'],
                    ['Forma de Pagamento', selected.payment_method_description ?? '—'],
                    ['Vencimento',         isoToBR(selected.due_date) || '—'],
                    ['Data de Pagamento',  isoToBR(selected.payment_date) || '—'],
                    ['Valor',              selected.value != null ? fmt(selected.value) : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="detail-row">
                      <span className="detail-label">{label}</span>
                      <span className="detail-value">{value}</span>
                    </div>
                  ))}
                  <div className="detail-row">
                    <span className="detail-label">Status</span>
                    <span className="detail-value">
                      <span className={`payment-status payment-status-${getStatus(selected, today).toLowerCase()}`}>
                        {getStatus(selected, today)}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="form-actions" style={{ padding: '0 18px 18px' }}>
                  <button type="button" className="btn-edit" onClick={startEdit}>Editar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
