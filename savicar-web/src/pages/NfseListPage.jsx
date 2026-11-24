import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAllNf } from '../api'

const PAGE_SIZE = 10
const TIPO_NFS = 1

function fmtCurrency(val) {
  return Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateBR(val) {
  if (!val) return ''
  const datePart = val.slice(0, 10)
  const [year, month, day] = datePart.split('-')
  if (!year || !month || !day) return val
  return `${day}/${month}/${year}`
}

export default function NfseListPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchAllNf(TIPO_NFS)
      .then(data => setItems([...(data ?? [])].sort((a, b) => String(b.data_emissao ?? '').localeCompare(String(a.data_emissao ?? '')))))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>🧾 NFS-e</h2>
        <button className="btn-novo" onClick={() => navigate('/nfse')}>+ Nova NFS-e</button>
      </div>

      {loading && <p className="loading">Carregando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Data Emissão</th>
                <th>Tomador</th>
                <th>Valor Total</th>
                <th className="actions-col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length === 0 ? (
                <tr><td colSpan={5}>Nenhuma NFS-e encontrada.</td></tr>
              ) : (
                visibleItems.map(n => (
                  <tr key={n.numero}>
                    <td>{n.numero}</td>
                    <td>{fmtDateBR(n.data_emissao)}</td>
                    <td>{n.tomador ?? ''}</td>
                    <td>{fmtCurrency(n.valor_total_nota)}</td>
                    <td className="actions-col">
                      {n.url_download ? (
                        <a
                          className="btn-edit"
                          href={n.url_download}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: 'none', display: 'inline-block' }}
                        >
                          Download
                        </a>
                      ) : (
                        <button className="btn-edit" disabled title="PDF não disponível para esta nota">
                          Download
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (
        <div className="crud-footer">
          {totalPages > 1 && (
            <div className="crud-pagination">
              <button onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
              <span>{safePage} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
            </div>
          )}
          <span className="crud-counter">
            {items.length} {items.length === 1 ? 'registro' : 'registros'}
            {items.length > 0 && ` — exibindo ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, items.length)}`}
          </span>
        </div>
      )}
    </div>
  )
}
