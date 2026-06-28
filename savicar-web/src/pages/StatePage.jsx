import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAllState, createState, updateState, deleteState, fetchAllCountry } from '../api'
import { makeFormPages } from '../components/CrudFormPage'

export function StateForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    id_country: initialData?.id_country ?? '',
    name: initialData?.name ?? '',
    abbreviation: initialData?.abbreviation ?? '',
  })
  const [countries, setCountries] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllCountry().then(setCountries).catch(() => {})
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        id_country: form.id_country !== '' ? Number(form.id_country) : null,
      }
      if (isEdit) {
        await updateState(initialData.id_state, payload)
      } else {
        await createState(payload)
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
        <label>País</label>
        <select name="id_country" value={form.id_country} onChange={handleChange} required>
          <option value="">— Selecione —</option>
          {countries.map(c => (
            <option key={c.id_country} value={c.id_country}>{c.name}</option>
          ))}
        </select>
      </div>
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

export const { NewPage: StateNewPage, EditPage: StateEditPage } = makeFormPages(StateForm, 'Estados', '/states')

export default function StatePage() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])   // [{ country, states }]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})  // { id_country: bool }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [states, countries] = await Promise.all([fetchAllState(), fetchAllCountry()])
      const countryMap = Object.fromEntries(countries.map(c => [c.id_country, c]))
      const groupMap = {}
      for (const s of states) {
        const cid = s.id_country ?? 0
        if (!groupMap[cid]) groupMap[cid] = { country: countryMap[cid] ?? { id_country: cid, name: '(sem país)' }, states: [] }
        groupMap[cid].states.push(s)
      }
      const sorted = Object.values(groupMap).sort((a, b) =>
        (a.country.name ?? '').localeCompare(b.country.name ?? '')
      )
      setGroups(sorted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggle(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleDelete(state) {
    if (!window.confirm(`Excluir estado "${state.name}"?`)) return
    try {
      await deleteState(state.id_state)
      await load()
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>Estados</h2>
        <button className="btn-novo" onClick={() => navigate('/states/new')}>+ Novo</button>
      </div>

      {loading && <p className="loading">Carregando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>País / Estado</th>
              <th>Sigla</th>
              <th className="actions-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ country, states }) => (
              <>
                <tr
                  key={`country-${country.id_country}`}
                  className="state-group-header"
                  onClick={() => toggle(country.id_country)}
                >
                  <td colSpan={2}>
                    <span className="state-group-toggle">
                      {expanded[country.id_country] ? '−' : '+'}
                    </span>
                    {country.name}
                    <span className="state-group-count">{states.length}</span>
                  </td>
                  <td className="actions-col" />
                </tr>
                {expanded[country.id_country] && states.map(s => (
                  <tr key={s.id_state} className="state-row">
                    <td className="state-row-name">{s.name}</td>
                    <td>{s.abbreviation ?? ''}</td>
                    <td className="actions-col">
                      <button className="btn-edit" onClick={() => navigate('/states/edit', { state: { item: s } })}>Editar</button>
                      <button className="btn-delete" onClick={() => handleDelete(s)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      )}

    </div>
  )
}
