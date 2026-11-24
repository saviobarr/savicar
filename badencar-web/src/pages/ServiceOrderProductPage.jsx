import { useState } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllServiceOrderProduct,
  createServiceOrderProduct,
  updateServiceOrderProduct,
  deleteServiceOrderProduct,
} from '../api'

const FIELDS = [
  { key: 'id_service_order_product', label: 'ID' },
  { key: 'id_order', label: 'ID OS' },
  { key: 'id_product', label: 'ID Produto' },
  { key: 'quantity', label: 'Quantidade' },
]

export function ServiceOrderProductForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    id_order: initialData?.id_order ?? '',
    id_product: initialData?.id_product ?? '',
    quantity: initialData?.quantity ?? '',
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
        await updateServiceOrderProduct(initialData.id_service_order_product, form)
      } else {
        await createServiceOrderProduct(form)
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
        <label>ID da OS</label>
        <input type="number" name="id_order" value={form.id_order} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>ID Produto</label>
        <input type="number" name="id_product" value={form.id_product} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>Quantidade</label>
        <input type="number" step="any" name="quantity" value={form.quantity} onChange={handleChange} required />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: ServiceOrderProductNewPage, EditPage: ServiceOrderProductEditPage } = makeFormPages(ServiceOrderProductForm, 'Produtos da OS', '/service-order-products')

export default function ServiceOrderProductPage() {
  return (
    <CrudPage
      title="Produtos da OS"
      fetchAll={fetchAllServiceOrderProduct}
      deleteItem={deleteServiceOrderProduct}
      fields={FIELDS}
      FormComponent={ServiceOrderProductForm}
      basePath="/service-order-products"
    />
  )
}
