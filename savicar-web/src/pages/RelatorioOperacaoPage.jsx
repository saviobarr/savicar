import { useState, useRef } from 'react'
import { fetchDailyFinancialReport } from '../api'

function fmt(val) {
  return Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function todayISO() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function ResultBadge({ value }) {
  const num = Number(value ?? 0)
  let bg, color, border
  if (num > 0)      { bg = '#0d2d4a'; color = '#4fc3f7'; border = '2px solid #1e88e5' }
  else if (num < 0) { bg = '#3b0a0a'; color = '#ef9a9a'; border = '2px solid #e53935' }
  else              { bg = '#2a2200'; color = '#fff176'; border = '2px solid #fdd835' }

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      background: bg, border, borderRadius: '16px',
      padding: '18px 36px', minWidth: '200px',
    }}>
      <span style={{ color, fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
        Resultado
      </span>
      <span style={{ color, fontSize: '1.8rem', fontWeight: 700 }}>{fmt(num)}</span>
    </div>
  )
}

export default function RelatorioOperacaoPage() {
  const today = todayISO()

  const [fromDisplay, setFromDisplay] = useState(isoToBR(today))
  const [toDisplay,   setToDisplay]   = useState(isoToBR(today))
  const [report, setReport]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [expanded, setExpanded] = useState({})
  const [techExpanded, setTechExpanded] = useState({})
  const fromPickerRef = useRef(null)
  const toPickerRef   = useRef(null)

  function toggleOS(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleTech(id) {
    setTechExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const fromISO = brToISO(fromDisplay)
  const toISO   = brToISO(toDisplay)

  async function search(from, to) {
    if (!from || !to) return
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      setReport(await fetchDailyFinancialReport(from, to))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleFromText(e) {
    const masked = maskDate(e.target.value)
    setFromDisplay(masked)
    const iso = brToISO(masked)
    if (iso && toISO) search(iso, toISO)
  }

  function handleToText(e) {
    const masked = maskDate(e.target.value)
    setToDisplay(masked)
    const iso = brToISO(masked)
    if (fromISO && iso) search(fromISO, iso)
  }

  function handleFromPicker(e) {
    const iso = e.target.value
    setFromDisplay(isoToBR(iso))
    if (iso && toISO) search(iso, toISO)
  }

  function handleToPicker(e) {
    const iso = e.target.value
    setToDisplay(isoToBR(iso))
    if (fromISO && iso) search(fromISO, iso)
  }

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>📊 Resultado do Período</h2>
      </div>

      {/* ── Period filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <span style={{ color: '#aaa', fontSize: '0.9rem' }}>De</span>
        <div className="date-picker-wrapper">
          <input type="text" value={fromDisplay} onChange={handleFromText}
            placeholder="dd/mm/aaaa" maxLength={10} className="crud-search" style={{ width: '130px' }} />
          <input type="date" ref={fromPickerRef} className="hidden-date-picker" onChange={handleFromPicker} />
          <button type="button" className="btn-calendar" onClick={() => fromPickerRef.current?.showPicker()}>📅</button>
        </div>

        <span style={{ color: '#aaa', fontSize: '0.9rem' }}>Até</span>
        <div className="date-picker-wrapper">
          <input type="text" value={toDisplay} onChange={handleToText}
            placeholder="dd/mm/aaaa" maxLength={10} className="crud-search" style={{ width: '130px' }} />
          <input type="date" ref={toPickerRef} className="hidden-date-picker" onChange={handleToPicker} />
          <button type="button" className="btn-calendar" onClick={() => toPickerRef.current?.showPicker()}>📅</button>
        </div>

        {loading && <span style={{ color: '#aaa', fontSize: '0.9rem' }}>Carregando...</span>}
      </div>

      {error && <p className="error">{error}</p>}

      {!fromISO && !toISO && !loading && (
        <p style={{ color: '#888' }}>Selecione o período para ver o resultado.</p>
      )}

      {report && !loading && (
        <>
          {report.orders.length === 0 ? (
            <p style={{ color: '#aaa' }}>Nenhuma OS encontrada para o período {fromDisplay} – {toDisplay}.</p>
          ) : (
            <>
              {/* ── One card per OS ── */}
              {report.orders.map(o => {
                const res = Number(o.result)
                const resColor = res > 0 ? '#4fc3f7' : res < 0 ? '#ef9a9a' : '#fff176'
                const isOpen = !!expanded[o.id_order]
                return (
                  <div key={o.id_order} style={{
                    border: '1px solid #2a2a2a',
                    borderRadius: '10px',
                    marginBottom: '20px',
                    overflow: 'hidden',
                  }}>
                    {/* Card header */}
                    <div
                      onClick={() => toggleOS(o.id_order)}
                      style={{
                        background: '#1e1e1e',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: isOpen ? '1px solid #2a2a2a' : 'none',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          border: '1px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', color: '#aaa', flexShrink: 0, lineHeight: 1,
                        }}>
                          {isOpen ? '−' : '+'}
                        </span>
                        <span style={{ fontWeight: 700, color: '#eee', fontSize: '1rem' }}>
                          OS <span style={{ color: '#f5c800' }}>#{o.id_order}</span>
                          {o.customer_name && <span style={{ color: '#aaa', fontWeight: 400, fontSize: '0.9rem', marginLeft: '12px' }}>— {o.customer_name}</span>}
                        </span>
                      </div>
                      <span style={{ color: resColor, fontWeight: 700, fontSize: '1rem' }}>
                        Resultado: {fmt(res)}
                      </span>
                    </div>

                    {/* Card body: two panels side by side */}
                    {isOpen && <div style={{ display: 'flex', gap: 0 }}>
                      {/* Receitas */}
                      <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid #2a2a2a' }}>
                        <div style={{ color: '#4fc3f7', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                          Receitas
                        </div>
                        <table style={{ width: '100%', fontSize: '0.88rem' }}>
                          <tbody>
                            <tr>
                              <td style={{ color: '#aaa', paddingBottom: '6px' }}>Serviços</td>
                              <td style={{ textAlign: 'right', paddingBottom: '6px' }}>{fmt(o.service_income)}</td>
                            </tr>
                            <tr>
                              <td style={{ color: '#aaa', paddingBottom: '6px' }}>Produtos</td>
                              <td style={{ textAlign: 'right', paddingBottom: '6px' }}>{fmt(o.product_income)}</td>
                            </tr>
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '1px solid #333' }}>
                              <td style={{ paddingTop: '8px', fontWeight: 600, color: '#ccc' }}>Total</td>
                              <td style={{ paddingTop: '8px', textAlign: 'right', fontWeight: 700, color: '#4fc3f7', fontSize: '1rem' }}>{fmt(o.total_income)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Custos */}
                      <div style={{ flex: 1, padding: '14px 16px' }}>
                        <div style={{ color: '#ef9a9a', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                          Custos
                        </div>
                        <table style={{ width: '100%', fontSize: '0.88rem' }}>
                          <tbody>
                            <tr>
                              <td style={{ color: '#aaa', paddingBottom: '6px' }}>Produtos</td>
                              <td style={{ textAlign: 'right', paddingBottom: '6px' }}>{fmt(o.product_cost)}</td>
                            </tr>
                            <tr>
                              <td style={{ color: '#aaa', paddingBottom: '6px' }}>Desconto</td>
                              <td style={{ textAlign: 'right', paddingBottom: '6px' }}>{fmt(o.discount)}</td>
                            </tr>
                            <tr>
                              <td style={{ color: '#aaa', paddingBottom: '6px' }}>
                                <span>Técnico (comissão)</span>
                                {o.technician_breakdown?.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleTech(o.id_order)}
                                    style={{
                                      marginLeft: '8px', background: 'none', border: '1px solid #555',
                                      borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer',
                                      color: '#aaa', fontSize: '0.75rem', lineHeight: 1,
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                  >
                                    {techExpanded[o.id_order] ? '−' : '+'}
                                  </button>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', paddingBottom: '6px' }}>{fmt(o.technician_cost)}</td>
                            </tr>
                            {techExpanded[o.id_order] && o.technician_breakdown?.map((tb, i) => (
                              <tr key={i}>
                                <td style={{ color: '#777', paddingBottom: '4px', paddingLeft: '16px', fontSize: '0.8rem' }}>
                                  ↳ {tb.technician_name}
                                </td>
                                <td style={{ textAlign: 'right', paddingBottom: '4px', color: '#999', fontSize: '0.8rem' }}>
                                  {fmt(tb.cost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '1px solid #333' }}>
                              <td style={{ paddingTop: '8px', fontWeight: 600, color: '#ccc' }}>Total</td>
                              <td style={{ paddingTop: '8px', textAlign: 'right', fontWeight: 700, color: '#ef9a9a', fontSize: '1rem' }}>{fmt(o.total_cost)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>}
                  </div>
                )
              })}

              {/* ── Day summary ── */}
              <div style={{ display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px', paddingTop: '16px', borderTop: '2px solid #333' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ color: '#aaa', fontSize: '0.85rem' }}>Receita Total do Período</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4fc3f7' }}>{fmt(report.total_income)}</div>
                  <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '6px' }}>Custo Total do Período</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef9a9a' }}>{fmt(report.total_cost)}</div>
                </div>
                <ResultBadge value={report.result} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
