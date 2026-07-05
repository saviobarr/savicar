import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

function normalize(str) {
  return String(str ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function CrudPage({ title, fetchAll, deleteItem, fields, FormComponent, createLabel = '+ Novo', idKey, filterKeys, filterPlaceholder = 'Filtrar...', DetailComponent, pageSize, closeOnOverlayClick = true, basePath, extraActions, extraFilters, additionalFilter, rowActions }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [search, setSearch] = useState('')
  const [detailItem, setDetailItem] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAll()
      setItems(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchAll])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    if (basePath) { navigate(basePath + '/new'); return }
    setEditingItem(null)
    setModalOpen(true)
  }

  function openEdit(item) {
    if (basePath) { navigate(basePath + '/edit', { state: { item } }); return }
    setEditingItem(item)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
  }

  const pkKey = idKey ?? fields[0].key

  function askDelete(item) {
    setDeleteTarget(item)
    setDeleteError(null)
  }

  function cancelDelete() {
    setDeleteTarget(null)
    setDeleteError(null)
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteItem(deleteTarget[pkKey])
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleSaved() {
    closeModal()
    await load()
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  const filteredItems = items
    .filter(item => !filterKeys || !search.trim() || filterKeys.some(k => normalize(item[k]).includes(normalize(search))))
    .filter(item => !additionalFilter || additionalFilter(item))
    .sort((a, b) => {
      if (!sortKey) return 0
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const an = Number(av), bn = Number(bv)
      const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

  const totalPages = pageSize ? Math.max(1, Math.ceil(filteredItems.length / pageSize)) : 1
  const safePage = Math.min(currentPage, totalPages)
  const visibleItems = pageSize
    ? filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize)
    : filteredItems

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>{title}</h2>
        <button className="btn-novo" onClick={openCreate}>{createLabel}</button>
        {extraActions}
      </div>
      {(filterKeys || extraFilters) && (
        <div className="crud-filters">
          {filterKeys && (
            <input
              className="crud-search"
              type="text"
              placeholder={filterPlaceholder}
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            />
          )}
          {extraFilters}
        </div>
      )}

      {loading && <p className="loading">Carregando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div style={{ width: '100%', overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {fields.map(f => (
                <th
                  key={f.key}
                  style={{ ...f.thStyle, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort(f.key)}
                >
                  {f.label}{' '}
                  <span style={{ opacity: sortKey === f.key ? 1 : 0.35, fontSize: '0.75em' }}>
                    {sortKey === f.key ? (sortDir === 'asc' ? '▲' : '▼') : '⬍'}
                  </span>
                </th>
              ))}
              <th className="actions-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr><td colSpan={fields.length + 1}>Nenhum registro encontrado.</td></tr>
            ) : (
              visibleItems.map((item, idx) => (
                <tr
                  key={item[pkKey] ?? idx}
                  className={DetailComponent ? 'row-clickable' : undefined}
                  onClick={DetailComponent ? () => setDetailItem(item) : undefined}
                >
                  {fields.map(f => (
                    <td key={f.key}>
                      {f.render
                        ? f.render(item[f.key], item)
                        : typeof item[f.key] === 'boolean'
                          ? (item[f.key] ? 'Sim' : 'Não')
                          : String(item[f.key] ?? '')}
                    </td>
                  ))}
                  <td className="actions-col" onClick={e => e.stopPropagation()}>
                    {rowActions && rowActions(item)}
                    <button className="btn-edit" onClick={() => openEdit(item)}>Editar</button>
                    <button className="btn-delete" onClick={() => askDelete(item)}>Excluir</button>
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
          {pageSize && totalPages > 1 && (
            <div className="crud-pagination">
              <button onClick={() => setCurrentPage(1)} disabled={safePage === 1}>«</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
              <span>{safePage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}>»</button>
            </div>
          )}
          <span className="crud-counter">
            {filteredItems.length} {filteredItems.length === 1 ? 'registro' : 'registros'}
            {pageSize && filteredItems.length > 0 && ` — exibindo ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredItems.length)}`}
          </span>
        </div>
      )}

      {modalOpen && (
        <div className="form-modal-overlay" onClick={closeOnOverlayClick ? closeModal : undefined}>
          <div className="form-modal" onClick={e => e.stopPropagation()}>
            <div className="form-modal-header">
              <span>{editingItem ? 'Editar' : 'Novo'} — {title}</span>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <FormComponent
              key={editingItem ? String(editingItem[pkKey]) : '__new__'}
              initialData={editingItem}
              onSaved={handleSaved}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}

      {detailItem && createPortal(
        <div className="form-modal-overlay" onClick={() => setDetailItem(null)}>
          <div className="form-modal detail-modal" onClick={e => e.stopPropagation()}>
            <div className="form-modal-header">
              <span>Detalhes — {title}</span>
              <button className="modal-close" onClick={() => setDetailItem(null)}>✕</button>
            </div>
            <DetailComponent data={detailItem} onClose={() => setDetailItem(null)} />
          </div>
        </div>,
        document.body
      )}

      {deleteTarget && createPortal(
        <div className="form-modal-overlay" onClick={cancelDelete}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="form-modal-header">
              <span>Confirmar exclusão</span>
              <button className="modal-close" onClick={cancelDelete}>✕</button>
            </div>
            <div className="confirm-modal-body">
              <p>Deseja excluir este registro?</p>
              {deleteError && <p className="error">{deleteError}</p>}
              <div className="form-actions">
                <button className="btn-delete" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </button>
                <button type="button" onClick={cancelDelete} disabled={deleting}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
