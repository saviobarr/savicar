import { useState } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllServices,
  createServices,
  updateServices,
  deleteServices,
} from '../api'

const FIELDS = [
  { key: 'id_service', label: 'ID' },
  { key: 'code', label: 'Código' },
  { key: 'hours_quantity', label: 'Horas' },
  { key: 'unit_value', label: 'Valor Unit.' },
  { key: 'total_value', label: 'Valor Total' },
  { key: 'id_order', label: 'ID OS' },
]

export function ServicesForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    code: initialData?.code ?? '',
    hours_quantity: initialData?.hours_quantity ?? '',
    unit_value: initialData?.unit_value ?? '',
    total_value: initialData?.total_value ?? '',
    id_order: initialData?.id_order ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateServices(initialData.id_service, form)
      } else {
        await createServices(form)
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
        <label>Código</label>
        <input type="text" name="code" value={form.code} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Quantidade de Horas</label>
        <input type="number" step="any" name="hours_quantity" value={form.hours_quantity} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Valor Unitário</label>
        <input type="number" step="any" name="unit_value" value={form.unit_value} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Valor Total</label>
        <input type="number" step="any" name="total_value" value={form.total_value} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>ID da OS</label>
        <input type="number" name="id_order" value={form.id_order} onChange={handleChange} required />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: ServicesNewPage, EditPage: ServicesEditPage } = makeFormPages(ServicesForm, 'Serviços', '/services')

export default function ServicesPage() {
  return (
    <CrudPage
      title="Serviços"
      fetchAll={fetchAllServices}
      deleteItem={deleteServices}
      fields={FIELDS}
      FormComponent={ServicesForm}
      basePath="/services"
    />
  )
}
