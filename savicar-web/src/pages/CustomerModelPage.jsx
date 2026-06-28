import { useState, useEffect } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllCustomerModel,
  createCustomerModel,
  updateCustomerModel,
  deleteCustomerModel,
  fetchAllCustomer,
  fetchAllVehicleMake,
  fetchAllVehicleModel,
} from '../api'

function customerDisplayName(c) {
  return c.individual_name || c.trade_name || c.legal_name || `Cliente #${c.id_customer}`
}

const FIELDS = [
  { key: 'customer_name', label: 'Cliente' },
  { key: 'model_name', label: 'Modelo' },
  { key: 'plate', label: 'Placa' },
  { key: 'year_make', label: 'Ano Fab.' },
  { key: 'year_model', label: 'Ano Modelo' },
  { key: 'color', label: 'Cor' },
]

export function CustomerModelForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    id_customer: initialData?.id_customer ?? '',
    id_make: '',
    id_model: initialData?.id_model ?? '',
    plate: initialData?.plate ?? '',
    year_make: initialData?.year_make ?? '',
    year_model: initialData?.year_model ?? '',
    color: initialData?.color ?? '',
    vin: initialData?.vin ?? '',
  })
  const [customers, setCustomers] = useState([])
  const [makes, setMakes] = useState([])
  const [allModels, setAllModels] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllCustomer()
      .then(data => setCustomers(
        (data ?? []).sort((a, b) => customerDisplayName(a).localeCompare(customerDisplayName(b), 'pt-BR', { sensitivity: 'base' }))
      ))
      .catch(() => {})
    fetchAllVehicleMake().then(data => setMakes(data ?? [])).catch(() => {})
    fetchAllVehicleModel().then(data => {
      setAllModels(data ?? [])
      if (initialData?.id_model) {
        const found = (data ?? []).find(m => m.id_model === Number(initialData.id_model))
        if (found?.id_make) setForm(prev => ({ ...prev, id_make: String(found.id_make) }))
      }
    }).catch(() => {})
  }, [])

  const filteredModels = form.id_make
    ? allModels.filter(m => String(m.id_make) === String(form.id_make))
    : allModels

  function handleChange(e) {
    const { name, value } = e.target
    if (name === 'id_make') {
      setForm(prev => ({ ...prev, id_make: value, id_model: '' }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { id_make, ...rest } = form
      const payload = {
        ...rest,
        id_customer: rest.id_customer !== '' ? Number(rest.id_customer) : null,
        id_model: rest.id_model !== '' ? Number(rest.id_model) : null,
        year_make: rest.year_make !== '' ? Number(rest.year_make) : null,
        year_model: rest.year_model !== '' ? Number(rest.year_model) : null,
        vin: rest.vin || null,
      }
      if (isEdit) {
        await updateCustomerModel(initialData.id_customer_model, payload)
      } else {
        await createCustomerModel(payload)
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
        <label>Cliente</label>
        <select name="id_customer" value={form.id_customer} onChange={handleChange} required>
          <option value="">— Selecione —</option>
          {customers.map(c => (
            <option key={c.id_customer} value={c.id_customer}>{customerDisplayName(c)}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Marca</label>
        <select name="id_make" value={form.id_make} onChange={handleChange}>
          <option value="">— Todas —</option>
          {makes.map(mk => (
            <option key={mk.id_make} value={mk.id_make}>{mk.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Modelo</label>
        <select name="id_model" value={form.id_model} onChange={handleChange} required>
          <option value="">— Selecione —</option>
          {filteredModels
            .slice()
            .sort((a, b) => {
              const la = `${a.name ?? ''}${a.version ? ` ${a.version}` : ''}`.toLowerCase()
              const lb = `${b.name ?? ''}${b.version ? ` ${b.version}` : ''}`.toLowerCase()
              return la.localeCompare(lb)
            })
            .map(m => (
              <option key={m.id_model} value={m.id_model}>
                {m.name}{m.version ? ` ${m.version}` : ''}
              </option>
            ))}
        </select>
      </div>
      <div className="form-group">
        <label>Placa</label>
        <input type="text" name="plate" value={form.plate} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Ano Fabricação</label>
        <input type="number" name="year_make" value={form.year_make} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Ano Modelo</label>
        <input type="number" name="year_model" value={form.year_model} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Cor</label>
        <input type="text" name="color" value={form.color} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Chassi (VIN)</label>
        <input type="text" name="vin" value={form.vin} onChange={handleChange} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: CustomerModelNewPage, EditPage: CustomerModelEditPage } = makeFormPages(CustomerModelForm, 'Veículos do Cliente', '/customer-models')

export default function CustomerModelPage() {
  return (
    <CrudPage
      title="🚗 Veículos do Cliente"
      fetchAll={fetchAllCustomerModel}
      deleteItem={deleteCustomerModel}
      fields={FIELDS}
      idKey="id_customer_model"
      FormComponent={CustomerModelForm}
      filterKeys={['customer_name', 'model_name', 'plate']}
      filterPlaceholder="Cliente, Modelo ou Placa..."
      pageSize={15}
      basePath="/customer-models"
    />
  )
}
