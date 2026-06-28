import { useState } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import { fetchAllCountry, createCountry, updateCountry, deleteCountry } from '../api'

const FIELDS = [
  { key: 'name', label: 'Nome' },
  { key: 'abbreviation', label: 'Sigla' },
]

export function CountryForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    abbreviation: initialData?.abbreviation ?? '',
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
        await updateCountry(initialData.id_country, form)
      } else {
        await createCountry(form)
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
        <input type="text" name="name" value={form.name} onChange={handleChange} required autoFocus />
      </div>
      <div className="form-group">
        <label>Sigla</label>
        <input type="text" name="abbreviation" value={form.abbreviation} onChange={handleChange} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: CountryNewPage, EditPage: CountryEditPage } = makeFormPages(CountryForm, 'Países', '/countries')

export default function CountryPage() {
  return (
    <CrudPage
      title="Países"
      fetchAll={fetchAllCountry}
      deleteItem={deleteCountry}
      fields={FIELDS}
      idKey="id_country"
      FormComponent={CountryForm}
      filterKeys={['name', 'abbreviation']}
      filterPlaceholder="Filtrar por nome ou sigla..."
      pageSize={15}
      basePath="/countries"
    />
  )
}
