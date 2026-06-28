import { useState, useEffect } from 'react'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllTechnician,
  createTechnician,
  updateTechnician,
  deleteTechnician,
  fetchAllUsers,
} from '../api'

const FIELDS = [
  { key: 'name', label: 'Nome' },
]

function fmtCurrency(val) {
  if (val === '' || val == null) return ''
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function TechnicianForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    name:    initialData?.name    ?? '',
    salary:  initialData?.salary  ?? '',
    percent: initialData?.percent ?? '',
    id_user: initialData?.id_user ?? '',
  })
  const [users, setUsers] = useState([])
  const [userQuery, setUserQuery] = useState('')
  const [userOpen, setUserOpen] = useState(false)
  const [salaryFocused, setSalaryFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllUsers().then(data => {
      setUsers(data ?? [])
      if (initialData?.id_user) {
        const u = (data ?? []).find(u => u.id_user === initialData.id_user)
        if (u) setUserQuery(u.name)
      }
    }).catch(() => {})
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const filteredUsers = userQuery.trim()
    ? users.filter(u =>
        u.name?.toLowerCase().includes(userQuery.toLowerCase()) ||
        u.user_name?.toLowerCase().includes(userQuery.toLowerCase())
      )
    : users

  function selectUser(u) {
    setForm(prev => ({ ...prev, id_user: u.id_user }))
    setUserQuery(u.name)
    setUserOpen(false)
  }

  function clearUser() {
    setForm(prev => ({ ...prev, id_user: '' }))
    setUserQuery('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name:    form.name || null,
        salary:  form.salary  !== '' ? Number(form.salary)  : null,
        percent: form.percent !== '' ? Number(form.percent) : null,
        id_user: form.id_user !== '' ? Number(form.id_user) : null,
      }
      if (isEdit) {
        await updateTechnician(initialData.id_technician, payload)
      } else {
        await createTechnician(payload)
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
      <div className="form-group">
        <label>Salário</label>
        <input
          type="text"
          name="salary"
          value={salaryFocused ? (form.salary ?? '') : fmtCurrency(form.salary)}
          placeholder="R$ 0,00"
          onChange={e => {
            const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
            setForm(prev => ({ ...prev, salary: raw }))
          }}
          onFocus={() => setSalaryFocused(true)}
          onBlur={() => {
            setSalaryFocused(false)
            const num = parseFloat(String(form.salary).replace(',', '.'))
            setForm(prev => ({ ...prev, salary: isNaN(num) ? '' : String(num) }))
          }}
        />
      </div>
      <div className="form-group">
        <label>Comissão (%)</label>
        <input
          type="number" name="percent" value={form.percent} onChange={handleChange}
          min="0" max="100" step="0.01" placeholder="0,00"
          onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
        />
      </div>
      <div className="form-group" style={{ position: 'relative' }}>
        <label>Usuário do sistema</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={userQuery}
            onChange={e => { setUserQuery(e.target.value); setUserOpen(true) }}
            onFocus={() => setUserOpen(true)}
            onBlur={() => setTimeout(() => setUserOpen(false), 150)}
            placeholder="Digite nome ou login do usuário..."
            autoComplete="off"
          />
          {form.id_user && (
            <button type="button" onClick={clearUser}
              style={{ padding: '0 10px', background: 'transparent', border: '1px solid #555', borderRadius: 4, cursor: 'pointer', color: '#aaa' }}>
              ✕
            </button>
          )}
        </div>
        {userOpen && filteredUsers.length > 0 && (
          <ul style={{
            position: 'absolute', zIndex: 100, background: 'var(--surface, #1a1d27)',
            border: '1px solid #444', borderRadius: 4, listStyle: 'none',
            margin: 0, padding: 0, width: '100%', maxHeight: 200, overflowY: 'auto',
          }}>
            {filteredUsers.map(u => (
              <li key={u.id_user}
                onMouseDown={() => selectUser(u)}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                <strong>{u.name}</strong>
                <span style={{ color: '#888', marginLeft: 8, fontSize: '0.8rem' }}>@{u.user_name}</span>
              </li>
            ))}
          </ul>
        )}
        {form.id_user && (
          <p style={{ fontSize: '0.78rem', color: '#60a5fa', marginTop: 4 }}>
            Vinculado ao usuário ID #{form.id_user}
          </p>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: TechnicianNewPage, EditPage: TechnicianEditPage } = makeFormPages(TechnicianForm, 'Técnicos', '/technicians')

export default function TechnicianPage() {
  return (
    <CrudPage
      title="🧑‍🔧 Técnicos"
      fetchAll={fetchAllTechnician}
      deleteItem={deleteTechnician}
      fields={FIELDS}
      FormComponent={TechnicianForm}
      basePath="/technicians"
    />
  )
}
