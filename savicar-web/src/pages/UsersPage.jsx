import { useState, useEffect } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import { fetchAllUsers, createUser, updateUser, deleteUser, fetchTenantConfig } from '../api'

const PROFILES = [
  { value: 1, label: 'Admin' },
  { value: 2, label: 'Gerente' },
  { value: 3, label: 'Técnico' },
]

function profileLabel(value) {
  return PROFILES.find(p => p.value === Number(value))?.label ?? '—'
}

const FIELDS = [
  { key: 'name',      label: 'Nome' },
  { key: 'user_name', label: 'Usuário' },
  { key: 'profile',   label: 'Perfil', render: val => profileLabel(val) },
]

export function UserForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData?.id_user
  const [form, setForm] = useState({
    name:      initialData?.name      ?? '',
    user_name: initialData?.user_name ?? '',
    password:  '',
    profile:   initialData?.profile   ?? 1,
    id_tenant: initialData?.id_tenant ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!form.id_tenant) {
      fetchTenantConfig()
        .then(cfg => { if (cfg?.id_tenant) setForm(prev => ({ ...prev, id_tenant: cfg.id_tenant })) })
        .catch(() => {})
    }
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim())      { setError('Nome é obrigatório.'); return }
    if (!form.user_name.trim()) { setError('Usuário é obrigatório.'); return }
    if (!isEdit && !form.password.trim()) { setError('Senha é obrigatória.'); return }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        id_tenant: Number(form.id_tenant),
        name:      form.name.trim(),
        user_name: form.user_name.trim(),
        profile:   Number(form.profile),
      }
      if (form.password.trim()) payload.password = form.password.trim()

      const saved = isEdit
        ? await updateUser(initialData.id_user, payload)
        : await createUser(payload)
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <form onSubmit={handleSubmit} className="crud-form">
        <div className="form-group">
          <label>Nome</label>
          <input name="name" value={form.name} onChange={handleChange} autoFocus />
        </div>
        <div className="form-group">
          <label>Usuário</label>
          <input name="user_name" value={form.user_name} onChange={handleChange} autoComplete="off" />
        </div>
        <div className="form-group">
          <label>{isEdit ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </div>
        <div className="form-group">
          <label>Perfil</label>
          <select name="profile" value={form.profile} onChange={handleChange}>
            {PROFILES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          <button type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export const { NewPage: UserNewPage, EditPage: UserEditPage } = makeFormPages(UserForm, 'Usuários', '/users')

export default function UsersPage() {
  return (
    <CrudPage
      title="Usuários"
      fetchAll={fetchAllUsers}
      deleteItem={deleteUser}
      idKey="id_user"
      fields={FIELDS}
      FormComponent={UserForm}
      basePath="/users"
    />
  )
}
