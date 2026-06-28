import { useState, useEffect } from 'react'
import { fetchAllAudit } from '../api'

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return iso
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function AuditPage() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetchAllAudit()
      .then(data => setItems(data ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? items.filter(a =>
        a.user?.toLowerCase().includes(search.toLowerCase()) ||
        a.url_called?.toLowerCase().includes(search.toLowerCase())
      )
    : items

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>Auditoria</h2>
        <input
          type="text"
          placeholder="Filtrar por usuário ou URL..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      {loading && <p style={{ color: '#888', padding: '1rem' }}>Carregando...</p>}
      {error   && <p className="error">{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table className="services-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 140 }}>Data/Hora</th>
                <th style={{ width: 130 }}>Usuário</th>
                <th>URL</th>
                <th style={{ width: 60 }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: '1rem' }}>Nenhum registro encontrado.</td></tr>
              )}
              {filtered.map(a => (
                <>
                  <tr key={a.id_audit} style={{ cursor: a.payload ? 'pointer' : 'default' }}
                    onClick={() => a.payload && setExpanded(expanded === a.id_audit ? null : a.id_audit)}>
                    <td style={{ color: '#888' }}>{a.id_audit}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(a.dt_time)}</td>
                    <td>{a.user}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{a.url_called}</td>
                    <td style={{ textAlign: 'center' }}>
                      {a.payload ? (
                        <span style={{ color: '#60a5fa', fontSize: '0.75rem' }}>
                          {expanded === a.id_audit ? '▲' : '▼'}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                  {expanded === a.id_audit && (
                    <tr key={`${a.id_audit}-payload`}>
                      <td colSpan={5} style={{ background: '#0d1117', padding: '0.75rem 1rem' }}>
                        <pre style={{
                          margin: 0,
                          fontSize: '0.78rem',
                          color: '#a3e635',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          maxHeight: 300,
                          overflowY: 'auto',
                        }}>
                          {(() => {
                            try { return JSON.stringify(JSON.parse(a.payload), null, 2) }
                            catch { return a.payload }
                          })()}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          <p style={{ color: '#555', fontSize: '0.78rem', marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''} (últimos 500)
          </p>
        </div>
      )}
    </div>
  )
}
