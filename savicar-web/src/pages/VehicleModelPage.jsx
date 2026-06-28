import { useState, useEffect, useCallback } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import SearchSelect from '../components/SearchSelect'
import {
  fetchAllVehicleModel,
  fetchAllVehicleMake,
  fetchAllFuel,
  createVehicleModel,
  updateVehicleModel,
  deleteVehicleModel,
  fetchAllCustomerModel,
  deleteCustomerModel,
} from '../api'

const FIELDS = [
  { key: 'make_name', label: 'Marca' },
  { key: 'name', label: 'Nome' },
  { key: 'version', label: 'Versão' },
]

export function VehicleModelForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    id_make: initialData?.id_make ?? '',
    name: initialData?.name ?? '',
    version: initialData?.version ?? '',
    id_fuel: initialData?.id_fuel ?? '',
  })
  const [makes, setMakes] = useState([])
  const [fuels, setFuels] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllVehicleMake().then(data =>
      setMakes((data ?? []).map(m => ({ value: m.id_make, label: m.name })))
    )
    fetchAllFuel().then(data =>
      setFuels((data ?? []).map(f => ({ value: f.id_fuel, label: f.name })))
    )
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateVehicleModel(initialData.id_model, form)
      } else {
        await createVehicleModel(form)
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
        <label>Marca</label>
        <SearchSelect
          options={makes}
          value={form.id_make}
          onChange={v => setForm(prev => ({ ...prev, id_make: v }))}
          placeholder="Buscar marca..."
          required
        />
      </div>
      <div className="form-group">
        <label>Nome</label>
        <input type="text" name="name" value={form.name} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>Versão</label>
        <input type="text" name="version" value={form.version} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Combustível</label>
        <SearchSelect
          options={fuels}
          value={form.id_fuel}
          onChange={v => setForm(prev => ({ ...prev, id_fuel: v }))}
          placeholder="Buscar combustível..."
        />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

async function deleteVehicleModelCascade(id) {
  const customerModels = await fetchAllCustomerModel()
  const refs = customerModels.filter(cm => cm.id_model === id)
  await Promise.all(refs.map(cm => deleteCustomerModel(cm.id_customer_model)))
  await deleteVehicleModel(id)
}

async function fetchModelsWithMake() {
  const [models, makes] = await Promise.all([fetchAllVehicleModel(), fetchAllVehicleMake()])
  const makeMap = Object.fromEntries(makes.map(m => [m.id_make, m.name || '']))
  return (models ?? []).map(m => ({ ...m, make_name: makeMap[m.id_make] ?? '' }))
}

export const { NewPage: VehicleModelNewPage, EditPage: VehicleModelEditPage } = makeFormPages(VehicleModelForm, 'Modelos', '/models')

export default function VehicleModelPage() {
  const fetchAll = useCallback(fetchModelsWithMake, [])

  return (
    <CrudPage
      title="Modelos"
      fetchAll={fetchAll}
      deleteItem={deleteVehicleModelCascade}
      basePath="/models"
      fields={FIELDS}
      idKey="id_model"
      FormComponent={VehicleModelForm}
      filterKeys={['make_name', 'name', 'version']}
      filterPlaceholder="Filtrar por marca ou modelo..."
      pageSize={15}
    />
  )
}
