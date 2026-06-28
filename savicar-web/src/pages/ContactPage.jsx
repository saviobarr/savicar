import { useState, useEffect } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllContact,
  createContact,
  updateContact,
  deleteContact,
  fetchAllCity,
} from '../api'

const FIELDS = [
  { key: 'id_contact', label: 'ID' },
  { key: 'id_customer', label: 'ID Cliente' },
  { key: 'mobile_phone', label: 'Celular' },
  { key: 'is_mobile_phone_whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'E-mail' },
  { key: 'address', label: 'Endereço' },
  { key: 'address_number', label: 'Número' },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'id_city', label: 'ID Cidade' },
]

export function ContactForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    id_customer: initialData?.id_customer ?? '',
    mobile_phone: initialData?.mobile_phone ?? '',
    is_mobile_phone_whatsapp: initialData?.is_mobile_phone_whatsapp ?? false,
    email: initialData?.email ?? '',
    address: initialData?.address ?? '',
    address_number: initialData?.address_number ?? '',
    neighborhood: initialData?.neighborhood ?? '',
    id_city: initialData?.id_city ?? '',
  })
  const [cities, setCities] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllCity().then(setCities).catch(() => {})
  }, [])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        address_number: form.address_number !== '' ? Number(form.address_number) : null,
        id_city: form.id_city !== '' ? Number(form.id_city) : null,
        id_customer: form.id_customer !== '' ? Number(form.id_customer) : null,
      }
      if (isEdit) {
        await updateContact(initialData.id_contact, payload)
      } else {
        await createContact(payload)
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
        <label>ID Cliente</label>
        <input type="number" name="id_customer" value={form.id_customer} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>Celular</label>
        <input type="text" name="mobile_phone" value={form.mobile_phone} onChange={handleChange} />
      </div>
      <div className="form-group form-group-check">
        <label>
          <input type="checkbox" name="is_mobile_phone_whatsapp" checked={form.is_mobile_phone_whatsapp} onChange={handleChange} />
          {' '}WhatsApp
        </label>
      </div>
      <div className="form-group">
        <label>E-mail</label>
        <input type="email" name="email" value={form.email} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Endereço</label>
        <input type="text" name="address" value={form.address} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Número</label>
        <input type="number" name="address_number" value={form.address_number} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Bairro</label>
        <input type="text" name="neighborhood" value={form.neighborhood} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Cidade</label>
        <select name="id_city" value={form.id_city} onChange={handleChange}>
          <option value="">— Selecione —</option>
          {cities.map(c => (
            <option key={c.id_city} value={c.id_city}>{c.name}</option>
          ))}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: ContactNewPage, EditPage: ContactEditPage } = makeFormPages(ContactForm, 'Contatos', '/contacts')

export default function ContactPage() {
  return (
    <CrudPage
      title="Contatos"
      fetchAll={fetchAllContact}
      deleteItem={deleteContact}
      fields={FIELDS}
      FormComponent={ContactForm}
      basePath="/contacts"
    />
  )
}
