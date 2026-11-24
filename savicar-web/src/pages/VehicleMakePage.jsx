import { useState } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllVehicleMake,
  createVehicleMake,
  updateVehicleMake,
  deleteVehicleMake,
  fetchAllVehicleModel,
  deleteVehicleModel,
} from '../api'

export const TYPE_LABELS = {
  1: 'Veículos',
  2: 'Produtos',
  3: 'Ambos',
}

const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value: Number(value), label }))

const TYPE_COLORS = {
  1: '#3b82f6',
  2: '#10b981',
  3: '#8b5cf6',
}

function TypeBadge({ type }) {
  if (!type) return null
  const label = TYPE_LABELS[type] ?? type
  const color = TYPE_COLORS[type] ?? '#6b7280'
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

const FIELDS = [
  { key: 'id_make', label: 'ID' },
  { key: 'name', label: 'Nome' },
  { key: 'type', label: 'Tipo', render: (value) => <TypeBadge type={value} /> },
]

function ToggleSwitch({ checked, onChange, label, color }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="toggle-switch-track"
        style={{
          position: 'relative',
          width: 48, height: 26,
          borderRadius: 13,
          border: 'none',
          padding: 0,
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'background 0.2s, box-shadow 0.2s',
          ...(checked ? { background: color, boxShadow: `0 0 0 1px ${color}` } : null),
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: checked ? 25 : 3,
          width: 20, height: 20,
          borderRadius: '50%',
          background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', fontWeight: 700, lineHeight: 1,
          color: checked ? color : '#ef4444',
          boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          transition: 'left 0.2s',
        }}>
          {checked ? '✓' : '✕'}
        </span>
      </button>
      <span className="toggle-switch-label" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{label}</span>
    </label>
  )
}

function typeFromFlags(vehicles, products) {
  if (vehicles && products) return 3
  if (vehicles) return 1
  if (products) return 2
  return null
}

export function VehicleMakeForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [name, setName] = useState(initialData?.name ?? '')
  const [vehicles, setVehicles] = useState(initialData?.type === 1 || initialData?.type === 3)
  const [products, setProducts] = useState(initialData?.type === 2 || initialData?.type === 3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const type = typeFromFlags(vehicles, products)

  async function handleSubmit(e) {
    e.preventDefault()
    if (type === null) {
      setError('Selecione ao menos um tipo (Veículos ou Produtos).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = { name, type }
      if (isEdit) {
        await updateVehicleMake(initialData.id_make, payload)
      } else {
        await createVehicleMake(payload)
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
        <input type="text" name="name" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Tipo</label>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: 4 }}>
          <ToggleSwitch checked={vehicles} onChange={setVehicles} label="Veículos" color={TYPE_COLORS[1]} />
          <ToggleSwitch checked={products} onChange={setProducts} label="Produtos" color={TYPE_COLORS[2]} />
        </div>
        {type === null && !error && (
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: 6 }}>Selecione ao menos um tipo para poder salvar.</p>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving || type === null} title={type === null ? 'Selecione ao menos um tipo (Veículos ou Produtos)' : undefined}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

async function deleteMakeWithChildren(id) {
  const allModels = await fetchAllVehicleModel()
  const children = allModels.filter(m => m.id_make === id)
  await Promise.all(children.map(m => deleteVehicleModel(m.id_model)))
  await deleteVehicleMake(id)
}

export const { NewPage: VehicleMakeNewPage, EditPage: VehicleMakeEditPage } = makeFormPages(VehicleMakeForm, 'Marcas', '/makes')

export default function VehicleMakePage() {
  const [filterType, setFilterType] = useState('')

  return (
    <CrudPage
      title="Marcas"
      fetchAll={fetchAllVehicleMake}
      deleteItem={deleteMakeWithChildren}
      fields={FIELDS}
      FormComponent={VehicleMakeForm}
      filterKeys={['name']}
      filterPlaceholder="Filtrar por nome..."
      additionalFilter={item => !filterType || String(item.type) === filterType}
      extraFilters={
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterType('')}
            style={{
              padding: '3px 12px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer',
              border: filterType === '' ? '2px solid #60a5fa' : '2px solid transparent',
              background: filterType === '' ? '#1e3a5f' : '#2a2d3a',
              color: filterType === '' ? '#93c5fd' : '#9ca3af',
              transition: 'all 0.15s',
            }}
          >Todos</button>
          {TYPE_OPTIONS.map(opt => {
            const color = TYPE_COLORS[opt.value] ?? '#6b7280'
            const active = String(filterType) === String(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => setFilterType(active ? '' : String(opt.value))}
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
      }
      persistSearch={false}
      pageSize={15}
      basePath="/makes"
    />
  )
}
