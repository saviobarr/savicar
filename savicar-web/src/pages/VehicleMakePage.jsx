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

const FIELDS = [
  { key: 'id_make', label: 'ID' },
  { key: 'name', label: 'Nome' },
]

export function VehicleMakeForm({ initialData, onSaved, onCancel }) {
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
        await updateVehicleMake(initialData.id_make, form)
      } else {
        await createVehicleMake(form)
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

async function deleteMakeWithChildren(id) {
  const allModels = await fetchAllVehicleModel()
  const children = allModels.filter(m => m.id_make === id)
  await Promise.all(children.map(m => deleteVehicleModel(m.id_model)))
  await deleteVehicleMake(id)
}

export const { NewPage: VehicleMakeNewPage, EditPage: VehicleMakeEditPage } = makeFormPages(VehicleMakeForm, 'Marcas', '/makes')

export default function VehicleMakePage() {
  return (
    <CrudPage
      title="Marcas"
      fetchAll={fetchAllVehicleMake}
      deleteItem={deleteMakeWithChildren}
      fields={FIELDS}
      FormComponent={VehicleMakeForm}
      filterKeys={['name']}
      filterPlaceholder="Filtrar por nome..."
      pageSize={15}
      basePath="/makes"
    />
  )
}
