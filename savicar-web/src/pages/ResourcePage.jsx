import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import { useState } from 'react'
import { fetchAllResource, createResource, updateResource, deleteResource } from '../api'

const FIELDS = [
  { key: 'id_resource', label: 'ID' },
  { key: 'description', label: 'Descrição' },
]

function ResourceForm({ initialData, onSaved, onCancel }) {
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = { description: description || null }
      if (initialData) {
        await updateResource(initialData.id_resource, payload)
      } else {
        await createResource(payload)
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
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
          autoFocus
        />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: ResourceNewPage, EditPage: ResourceEditPage } = makeFormPages(ResourceForm, 'Recursos', '/resources')

export default function ResourcePage() {
  return (
    <CrudPage
      title="🛠️ Recursos"
      fetchAll={fetchAllResource}
      deleteItem={deleteResource}
      fields={FIELDS}
      idKey="id_resource"
      FormComponent={ResourceForm}
      filterKeys={['description']}
      filterPlaceholder="Filtrar por descrição..."
      basePath="/resources"
    />
  )
}
