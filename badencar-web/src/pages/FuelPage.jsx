import { useState } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllFuel,
  createFuel,
  updateFuel,
  deleteFuel,
} from '../api'

const FIELDS = [
  { key: 'id_fuel', label: 'ID' },
  { key: 'name', label: 'Nome' },
]

export function FuelForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    name: initialData?.name ?? '',
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
        await updateFuel(initialData.id_fuel, form)
      } else {
        await createFuel(form)
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
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: FuelNewPage, EditPage: FuelEditPage } = makeFormPages(FuelForm, 'Combustíveis', '/fuels')

export default function FuelPage() {
  return (
    <CrudPage
      title="Combustíveis"
      fetchAll={fetchAllFuel}
      deleteItem={deleteFuel}
      fields={FIELDS}
      FormComponent={FuelForm}
      basePath="/fuels"
    />
  )
}
