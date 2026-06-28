import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllInventory,
  createInventory,
  updateInventory,
  deleteInventory,
  fetchProductImages,
  uploadProductImage,
  deleteProductImage,
  getProductImageUrl,
  fetchAllVehicleMake,
  createVehicleMake,
  fetchAllUnity,
  adjustInventoryQuantity,
} from '../api'

const FIELDS = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Nome' },
  { key: 'storage_location', label: 'Local Estoque' },
  { key: 'current_quantity', label: 'Quantidade Atual' },
]

// ── Images panel for edit mode (product already exists) ────────
function SavedImagesPanel({ idProduct }) {
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    fetchProductImages(idProduct).then(data => setImages(data ?? [])).catch(() => {})
  }, [idProduct])

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const created = await uploadProductImage(idProduct, file)
      setImages(prev => [...prev, created])
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete(img) {
    if (!window.confirm('Excluir imagem?')) return
    try {
      await deleteProductImage(img.id_image)
      setImages(prev => prev.filter(i => i.id_image !== img.id_image))
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  return (
    <div className="contact-section">
      <div className="contact-section-header">
        <span>Imagens do Produto</span>
        <button type="button" className="btn-add-contact" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Enviando...' : '+ Adicionar'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
      {uploadError && <p className="error">{uploadError}</p>}
      {images.length === 0
        ? <p style={{ fontSize: '0.85rem', color: '#888' }}>Nenhuma imagem cadastrada.</p>
        : (
          <div className="product-images-grid">
            {images.map(img => (
              <div key={img.id_image} className="product-image-thumb">
                <img src={getProductImageUrl(img.id_image)} alt="" onClick={() => setLightbox(img)} />
                <button type="button" className="product-image-delete" onClick={() => handleDelete(img)} title="Excluir">✕</button>
              </div>
            ))}
          </div>
        )
      }
      {lightbox && createPortal(
        <div className="modal-overlay" onClick={() => setLightbox(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setLightbox(null)}>✕</button>
            <img src={getProductImageUrl(lightbox.id_image)} alt="Imagem ampliada" />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Images panel for create mode (pending files, uploaded after save) ─
function PendingImagesPanel({ pendingFiles, onAdd, onRemove }) {
  const fileRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    onAdd(file)
    e.target.value = ''
  }

  return (
    <div className="contact-section">
      <div className="contact-section-header">
        <span>Imagens do Produto</span>
        <button type="button" className="btn-add-contact" onClick={() => fileRef.current?.click()}>
          + Adicionar
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
      {pendingFiles.length === 0
        ? <p style={{ fontSize: '0.85rem', color: '#888' }}>Nenhuma imagem selecionada. Salve o produto para fazer o upload.</p>
        : (
          <div className="product-images-grid">
            {pendingFiles.map((f, idx) => (
              <div key={idx} className="product-image-thumb">
                <img src={URL.createObjectURL(f)} alt={f.name} />
                <button type="button" className="product-image-delete" onClick={() => onRemove(idx)} title="Remover">✕</button>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

function MakeAutocomplete({ value, onChange, makes }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [dropdownStyle, setDropdownStyle] = useState({})
  const inputRef = useRef(null)

  useEffect(() => {
    if (value && makes.length) {
      const found = makes.find(m => m.id_make === Number(value))
      if (found) setQuery(found.name)
    } else if (!value) {
      setQuery('')
    }
  }, [value, makes])

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
    openDropdown(makes.filter(m => m.name.toLowerCase().includes(q.toLowerCase())))
  }

  function handleFocus() {
    if (!query.trim()) openDropdown(makes)
    else if (suggestions.length) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownStyle({ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: rect.width, zIndex: 9999 })
      setOpen(true)
    }
  }

  function handleSelect(m) {
    setQuery(m.name)
    setSuggestions([])
    setOpen(false)
    onChange(m.id_make)
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (inputRef.current && !inputRef.current.contains(e.target)) setOpen(false)
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
        placeholder="Digite o nome da marca..."
        autoComplete="off"
      />
      {open && suggestions.length > 0 && createPortal(
        <ul className="autocomplete-list" style={dropdownStyle}>
          {suggestions.map(m => (
            <li key={m.id_make} onMouseDown={e => { e.preventDefault(); handleSelect(m) }}>
              <span className="autocomplete-name">{m.name}</span>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}

function NewMakeModal({ onSaved, onClose }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    e.stopPropagation()
    setSaving(true)
    setError(null)
    try {
      const created = await createVehicleMake({ name })
      onSaved(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="form-modal-overlay">
      <div className="form-modal" style={{ maxWidth: 360 }}>
        <div className="form-modal-header">
          <span>Novo Fabricante</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="crud-form">
          <div className="form-group">
            <label>Nome</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

function DuplicateCodeModal({ product, makes, fromSave, onNewItem, onEdit, onCancel }) {
  const maker = makes.find(m => m.id_make === product.id_make)
  const label = [product.code, maker?.name, product.name].filter(Boolean).join(' · ')

  return createPortal(
    <div className="form-modal-overlay">
      <div className="form-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="form-modal-header">
          <span>Código já cadastrado</span>
          <button className="modal-close" type="button" onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '6px' }}>
            O produto abaixo já possui este código:
          </p>
          <p style={{ color: '#f5c800', fontWeight: 600, fontSize: '0.95rem', marginBottom: '20px' }}>
            {label}
          </p>
          <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '20px' }}>
            O que deseja fazer?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="btn-novo"
              onClick={onNewItem}
              style={{ textAlign: 'left', padding: '10px 16px' }}
            >
              📋 {fromSave ? 'Confirmar cadastro com o mesmo código' : 'Cadastrar novo item com o mesmo código'}
            </button>
            <button
              type="button"
              onClick={onEdit}
              style={{
                textAlign: 'left', padding: '10px 16px',
                background: '#1a3a5c', color: '#7ab8f5', border: '1px solid #2a4a6c',
                borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
              }}
            >
              ✏️ Editar item existente
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                textAlign: 'left', padding: '10px 16px',
                background: 'transparent', color: '#aaa', border: '1px solid #444',
                borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem',
              }}
            >
              ✕ Cancelar inclusão
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function CodeAutocomplete({ value, onChange, onSelect, allProducts, makes }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const inputRef = useRef(null)

  function productSuggestionLabel(item) {
    const maker = makes.find(m => m.id_make === item.id_make)
    return [item.code, maker?.name, item.name].filter(Boolean).join(' · ')
  }

  function openDropdown(list) {
    if (!list.length) { setOpen(false); return }
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 320), zIndex: 9999 })
    setSuggestions(list)
    setOpen(true)
  }

  function handleInput(e) {
    const q = e.target.value
    onChange(q)
    if (!q.trim()) { setSuggestions([]); setOpen(false); return }
    const lower = q.toLowerCase()
    openDropdown(
      allProducts.filter(p => (p.code ?? '').toLowerCase().includes(lower)).slice(0, 12)
    )
  }

  function handleSelect(item) {
    setSuggestions([])
    setOpen(false)
    onSelect(item)
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (inputRef.current && !inputRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="autocomplete-wrapper">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInput}
        autoComplete="off"
        placeholder="Digite o código..."
      />
      {open && suggestions.length > 0 && createPortal(
        <ul className="autocomplete-list" style={dropdownStyle}>
          {suggestions.map(item => (
            <li key={item.id_product} onMouseDown={e => { e.preventDefault(); handleSelect(item) }}>
              <span className="autocomplete-name">{productSuggestionLabel(item)}</span>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}

export function InventoryForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    code: initialData?.code ?? '',
    provider: initialData?.provider ?? '',
    id_make: initialData?.id_make ?? '',
    id_unity: initialData?.id_unity ?? '',
    gross_weight: initialData?.gross_weight ?? '',
    net_weight: initialData?.net_weight ?? '',
    storage_location: initialData?.storage_location ?? '',
    min: initialData?.min ?? '',
    max: initialData?.max ?? '',
    gtin_ean_code: initialData?.gtin_ean_code ?? '',
    original_number: initialData?.original_number ?? '',
    sales_price: initialData?.sales_price ?? '',
    cost_price: initialData?.cost_price ?? '',
    product_size: initialData?.product_size ?? '',
    current_quantity: initialData?.current_quantity ?? '',
    product_details: initialData?.product_details ?? '',
  })
  const navigate = useNavigate()
  const [makes, setMakes] = useState([])
  const [unities, setUnities] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [duplicateModal, setDuplicateModal] = useState(null) // produto selecionado
  const [newMakeOpen, setNewMakeOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllVehicleMake().then(data => setMakes(data ?? [])).catch(() => {})
    fetchAllUnity().then(data => setUnities(data ?? [])).catch(() => {})
    fetchAllInventory().then(data => setAllProducts(data ?? [])).catch(() => {})
  }, [])

  function fillFormFromProduct(item) {
    setForm({
      name:               item.name               ?? '',
      code:               item.code               ?? '',
      provider:           item.provider           ?? '',
      id_make:            item.id_make            ?? '',
      id_unity:           item.id_unity           ?? '',
      gross_weight:       item.gross_weight       ?? '',
      net_weight:         item.net_weight         ?? '',
      storage_location:   item.storage_location   ?? '',
      min:                item.min                ?? '',
      max:                item.max                ?? '',
      gtin_ean_code:      item.gtin_ean_code      ?? '',
      original_number:    item.original_number    ?? '',
      sales_price:        item.sales_price        ?? '',
      cost_price:         item.cost_price         ?? '',
      product_size:       item.product_size       ?? '',
      current_quantity:   item.current_quantity   ?? '',
      product_details:    item.product_details    ?? '',
    })
  }

  function handleSelectExistingProduct(item) {
    setDuplicateModal(item)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Na inclusão, verificar se já existe produto com o mesmo código
    if (!isEdit && form.code?.trim()) {
      const existing = allProducts.find(
        p => (p.code ?? '').trim().toLowerCase() === form.code.trim().toLowerCase()
      )
      if (existing) {
        setDuplicateModal({ ...existing, _fromSave: true })
        return
      }
    }

    await doSave()
  }

  async function doSave() {
    setSaving(true)
    setError(null)
    try {
      const toInt = v => v !== '' && v != null ? Number(v) : null
      const toFloat = v => v !== '' && v != null ? Number(v) : null
      const toStr = v => v !== '' ? v : null
      const payload = {
        ...form,
        gtin_ean_code: toStr(form.gtin_ean_code),
        original_number: toStr(form.original_number),
        product_details: toStr(form.product_details),
        id_make: toInt(form.id_make),
        id_unity: toInt(form.id_unity),
        gross_weight: toInt(form.gross_weight),
        net_weight: toInt(form.net_weight),
        min: toInt(form.min),
        max: toInt(form.max),
        sales_price: toFloat(form.sales_price),
        cost_price: toFloat(form.cost_price),
        product_origin: toInt(form.product_origin),
        classification_type: toInt(form.classification_type),
        initial_inventory_quantity: toInt(form.initial_inventory_quantity),
        current_quantity: toInt(form.current_quantity),
      }
      if (isEdit) {
        await updateInventory(initialData.id_product, payload)
      } else {
        const created = await createInventory(payload)
        for (const file of pendingFiles) {
          await uploadProductImage(created.id_product, file)
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
        <label>Nome</label>
        <input type="text" name="name" value={form.name} onChange={handleChange} required />
      </div>

      {/* Código + Fabricante + Fornecedor — same line */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Código</label>
          <CodeAutocomplete
            value={form.code}
            onChange={val => setForm(prev => ({ ...prev, code: val }))}
            onSelect={handleSelectExistingProduct}
            allProducts={allProducts}
            makes={makes}
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Fabricante</label>
          <div className="autocomplete-with-add">
            <MakeAutocomplete
              value={form.id_make}
              onChange={val => setForm(prev => ({ ...prev, id_make: val }))}
              makes={makes}
            />
            <button type="button" className="btn-add-inline" title="Nova fabricante" onClick={() => setNewMakeOpen(true)}>+</button>
          </div>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Fornecedor</label>
          <input type="text" name="provider" value={form.provider} onChange={handleChange} />
        </div>
      </div>
      {newMakeOpen && (
        <NewMakeModal
          onSaved={created => {
            setMakes(prev => [...prev, created])
            setForm(prev => ({ ...prev, id_make: created.id_make }))
            setNewMakeOpen(false)
          }}
          onClose={() => setNewMakeOpen(false)}
        />
      )}

      {/* Quantidade Atual + Unidade + Mínimo + Máximo + Local de Estoque — same line */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Qtd. Atual</label>
          <input type="number" step="any" name="current_quantity" value={form.current_quantity} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Unidade</label>
          <select name="id_unity" value={form.id_unity} onChange={handleChange}>
            <option value="">— Selecione —</option>
            {unities.map(u => (
              <option key={u.id_unity} value={u.id_unity}>{u.description}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Qtd. Mínima</label>
          <input type="number" step="any" name="min" value={form.min} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Qtd. Máxima</label>
          <input type="number" step="any" name="max" value={form.max} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Local de Estoque</label>
          <input type="text" name="storage_location" value={form.storage_location} onChange={handleChange} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Preço de Custo</label>
          <input type="number" step="any" name="cost_price" value={form.cost_price} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Preço de Venda</label>
          <input type="number" step="any" name="sales_price" value={form.sales_price} onChange={handleChange} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Número Original</label>
          <input type="text" name="original_number" value={form.original_number} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>GTIN/EAN</label>
          <input type="text" name="gtin_ean_code" value={form.gtin_ean_code} onChange={handleChange} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Peso Bruto</label>
          <input type="number" step="any" name="gross_weight" value={form.gross_weight} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Peso Líquido</label>
          <input type="number" step="any" name="net_weight" value={form.net_weight} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Tamanho do Produto</label>
          <input type="text" name="product_size" value={form.product_size} onChange={handleChange} />
        </div>
      </div>

      <div className="form-group">
        <label>Detalhes do Produto</label>
        <textarea name="product_details" value={form.product_details} onChange={handleChange} rows={3} placeholder="Informações adicionais sobre o produto..." />
      </div>

      {isEdit
        ? <SavedImagesPanel idProduct={initialData.id_product} />
        : <PendingImagesPanel
            pendingFiles={pendingFiles}
            onAdd={f => setPendingFiles(prev => [...prev, f])}
            onRemove={idx => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
          />
      }

      {duplicateModal && (
        <DuplicateCodeModal
          product={duplicateModal}
          makes={makes}
          fromSave={duplicateModal._fromSave}
          onNewItem={() => {
            if (duplicateModal._fromSave) {
              // Veio do botão Salvar: confirmar e prosseguir com o save
              setDuplicateModal(null)
              doSave()
            } else {
              // Veio do autocomplete: preencher formulário
              fillFormFromProduct(duplicateModal)
              setDuplicateModal(null)
            }
          }}
          onEdit={() => {
            setDuplicateModal(null)
            navigate('/inventory/edit', { state: { item: duplicateModal } })
          }}
          onCancel={() => {
            setDuplicateModal(null)
            onCancel()
          }}
        />
      )}

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: InventoryNewPage, EditPage: InventoryEditPage } = makeFormPages(InventoryForm, 'Estoque', '/inventory')

// ── Stock Entry Modal ─────────────────────────────────────────
function StockEntryModal({ onSaved, onClose }) {
  const [items, setItems] = useState([])
  const [makes, setMakes] = useState([])
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const inputRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetchAllInventory().then(d => d ?? []),
      fetchAllVehicleMake().then(d => d ?? []),
    ]).then(([inv, mk]) => {
      setItems(inv)
      setMakes(mk)
    }).catch(() => {})
  }, [])

  function productLabel(item) {
    const maker = makes.find(m => m.id_make === item.id_make)
    const parts = [item.name]
    if (maker?.name) parts.push(maker.name)
    if (item.code) parts.push(`[${item.code}]`)
    return parts.filter(Boolean).join(' · ')
  }

  function openDropdown(list) {
    if (!list.length) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: rect.width, zIndex: 10000 })
    setSuggestions(list)
    setOpen(true)
  }

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    setSelectedProduct(null)
    if (!q.trim()) { setSuggestions([]); setOpen(false); return }
    const lower = q.toLowerCase()
    openDropdown(
      items.filter(i =>
        (i.name ?? '').toLowerCase().includes(lower) ||
        (i.code ?? '').toLowerCase().includes(lower) ||
        (makes.find(m => m.id_make === i.id_make)?.name ?? '').toLowerCase().includes(lower)
      ).slice(0, 15)
    )
  }

  function handleFocus() {
    if (!query.trim()) openDropdown(items.slice(0, 15))
    else if (suggestions.length) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownStyle({ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: rect.width, zIndex: 10000 })
      setOpen(true)
    }
  }

  function handleSelect(item) {
    setSelectedProduct(item)
    setQuery(productLabel(item))
    setSuggestions([])
    setOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (inputRef.current && !inputRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedProduct) { setError('Selecione um produto.'); return }
    const qty = parseInt(quantity, 10)
    if (!qty || qty <= 0) { setError('Informe uma quantidade válida.'); return }
    setSaving(true)
    setError(null)
    try {
      await adjustInventoryQuantity(selectedProduct.id_product, qty)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="form-modal-overlay">
      <div className="form-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="form-modal-header">
          <span>Entrada de Estoque</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="crud-form">
          <div className="form-group">
            <label>Produto</label>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInput}
              onFocus={handleFocus}
              placeholder="Digite o nome, código ou fabricante..."
              autoComplete="off"
              autoFocus
            />
            {open && suggestions.length > 0 && createPortal(
              <ul className="autocomplete-list" style={dropdownStyle}>
                {suggestions.map(item => (
                  <li key={item.id_product} onMouseDown={ev => { ev.preventDefault(); handleSelect(item) }}>
                    <span className="autocomplete-name">{productLabel(item)}</span>
                  </li>
                ))}
              </ul>,
              document.body
            )}
          </div>
          {selectedProduct && (
            <div className="form-group">
              <label>Quantidade Atual</label>
              <input type="text" value={selectedProduct.current_quantity ?? '0'} readOnly />
            </div>
          )}
          <div className="form-group">
            <label>Quantidade a Adicionar</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              min="1"
              step="1"
              placeholder="Ex.: 10"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-novo" disabled={saving}>
              {saving ? 'Salvando...' : 'Confirmar Entrada'}
            </button>
            <button type="button" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default function InventoryPage() {
  const [stockEntryOpen, setStockEntryOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <>
      <CrudPage
        key={reloadKey}
        title="📦 Estoque"
        fetchAll={fetchAllInventory}
        deleteItem={deleteInventory}
        fields={FIELDS}
        idKey="id_product"
        FormComponent={InventoryForm}
        filterKeys={['name', 'code', 'storage_location']}
        filterPlaceholder="Filtrar por nome, código ou local..."
        pageSize={15}
        basePath="/inventory"
        extraActions={
          <button className="btn-novo" onClick={() => setStockEntryOpen(true)}>
            Entrada Estoque
          </button>
        }
      />
      {stockEntryOpen && (
        <StockEntryModal
          onSaved={() => { setStockEntryOpen(false); setReloadKey(k => k + 1) }}
          onClose={() => setStockEntryOpen(false)}
        />
      )}
    </>
  )
}
