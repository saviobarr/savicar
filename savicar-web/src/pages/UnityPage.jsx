import { useState } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllUnity,
  createUnity,
  updateUnity,
  deleteUnity,
} from '../api'

const FIELDS = [
  { key: 'id_unity', label: 'ID' },
  { key: 'description', label: 'Descrição' },
]

export function UnityForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    description: initialData?.description ?? '',
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
        await updateUnity(initialData.id_unity, form)
      } else {
        await createUnity(form)
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
        <label>Descrição</label>
        <input type="text" name="description" value={form.description} onChange={handleChange} required autoFocus />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: UnityNewPage, EditPage: UnityEditPage } = makeFormPages(UnityForm, 'Unidades', '/unities')

export default function UnityPage() {
  return (
    <CrudPage
      title="Unidades"
      fetchAll={fetchAllUnity}
      deleteItem={deleteUnity}
      fields={FIELDS}
      idKey="id_unity"
      FormComponent={UnityForm}
      basePath="/unities"
    />
  )
}
