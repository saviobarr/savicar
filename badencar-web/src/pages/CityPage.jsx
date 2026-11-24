import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAllCity, createCity, updateCity, deleteCity, fetchAllCountry, fetchAllState } from '../api'
import { makeFormPages } from '../components/CrudFormPage'

export function CityForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    id_state: initialData?.id_state ?? '',
    name: initialData?.name ?? '',
    abbreviation: initialData?.abbreviation ?? '',
  })
  const [countries, setCountries] = useState([])
  const [allStates, setAllStates] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAllCountry().then(setCountries).catch(() => {})
    fetchAllState().then(data => {
      setAllStates(data)
      if (initialData?.id_state) {
        const st = data.find(s => s.id_state === initialData.id_state)
        if (st?.id_country) setSelectedCountry(String(st.id_country))
      }
    }).catch(() => {})
  }, [])

  const filteredStates = selectedCountry
    ? allStates.filter(s => String(s.id_country) === selectedCountry)
    : allStates

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
        id_state: form.id_state !== '' ? Number(form.id_state) : null,
      }
      if (isEdit) {
        await updateCity(initialData.id_city, payload)
      } else {
        await createCity(payload)
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
        <select value={selectedCountry} onChange={e => { setSelectedCountry(e.target.value); setForm(p => ({ ...p, id_state: '' })) }}>
          <option value="">— Todos os países —</option>
          {countries.map(c => (
            <option key={c.id_country} value={c.id_country}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Estado</label>
        <select name="id_state" value={form.id_state} onChange={handleChange} required>
          <option value="">— Selecione —</option>
          {filteredStates.map(s => (
            <option key={s.id_state} value={s.id_state}>{s.name}</option>
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

export const { NewPage: CityNewPage, EditPage: CityEditPage } = makeFormPages(CityForm, 'Cidades', '/cities')

export default function CityPage() {
  const navigate = useNavigate()
  const [tree, setTree] = useState([])   // [{ country, states: [{ state, cities: [] }] }]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedCountries, setExpandedCountries] = useState({})
  const [expandedStates, setExpandedStates] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cities, states, countries] = await Promise.all([
        fetchAllCity(), fetchAllState(), fetchAllCountry(),
      ])

      const countryMap = Object.fromEntries(countries.map(c => [c.id_country, c]))
      const stateMap = Object.fromEntries(states.map(s => [s.id_state, s]))

      // group cities by state
      const citiesByState = {}
      for (const city of cities) {
        const sid = city.id_state ?? 0
        if (!citiesByState[sid]) citiesByState[sid] = []
        citiesByState[sid].push(city)
      }

      // group states by country
      const statesByCountry = {}
      for (const s of states) {
        const cid = s.id_country ?? 0
        if (!statesByCountry[cid]) statesByCountry[cid] = []
        statesByCountry[cid].push(s)
      }

      // also collect states that only have cities (edge case)
      for (const sidStr of Object.keys(citiesByState)) {
        const sid = Number(sidStr)
        if (sid && !stateMap[sid]) {
          const cid = 0
          if (!statesByCountry[cid]) statesByCountry[cid] = []
          statesByCountry[cid].push({ id_state: sid, name: `Estado #${sid}`, id_country: 0 })
        }
      }

      const result = Object.entries(statesByCountry)
        .map(([cidStr, sts]) => {
          const cid = Number(cidStr)
          return {
            country: countryMap[cid] ?? { id_country: cid, name: '(sem país)' },
            states: sts
              .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
              .map(s => ({
                state: s,
                cities: (citiesByState[s.id_state] ?? [])
                  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
              })),
          }
        })
        .sort((a, b) => (a.country.name ?? '').localeCompare(b.country.name ?? ''))

      setTree(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggleCountry(id) {
    setExpandedCountries(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleState(id) {
    setExpandedStates(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleDelete(city) {
    if (!window.confirm(`Excluir cidade "${city.name}"?`)) return
    try {
      await deleteCity(city.id_city)
      await load()
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  const totalCities = tree.reduce((s, g) => s + g.states.reduce((ss, st) => ss + st.cities.length, 0), 0)

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>Cidades</h2>
        <button className="btn-novo" onClick={() => navigate('/cities/new')}>+ Nova</button>
      </div>

      {loading && <p className="loading">Carregando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>País / Estado / Cidade</th>
              <th>Sigla</th>
              <th className="actions-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tree.map(({ country, states }) => {
              const countryOpen = !!expandedCountries[country.id_country]
              const countryTotal = states.reduce((s, st) => s + st.cities.length, 0)
              return (
                <>
                  {/* ── Country row ── */}
                  <tr
                    key={`c-${country.id_country}`}
                    className="city-country-row"
                    onClick={() => toggleCountry(country.id_country)}
                  >
                    <td colSpan={2}>
                      <span className="tree-toggle">{countryOpen ? '−' : '+'}</span>
                      {country.name}
                      <span className="tree-count">{states.length} estados · {countryTotal} cidades</span>
                    </td>
                    <td className="actions-col" />
                  </tr>

                  {countryOpen && states.map(({ state, cities }) => {
                    const stateOpen = !!expandedStates[state.id_state]
                    return (
                      <>
                        {/* ── State row ── */}
                        <tr
                          key={`s-${state.id_state}`}
                          className="city-state-row"
                          onClick={() => toggleState(state.id_state)}
                        >
                          <td colSpan={2}>
                            <span className="tree-toggle">{stateOpen ? '−' : '+'}</span>
                            {state.name}
                            <span className="tree-count">{cities.length} cidades</span>
                          </td>
                          <td className="actions-col" />
                        </tr>

                        {/* ── City rows ── */}
                        {stateOpen && cities.map(city => (
                          <tr key={`city-${city.id_city}`} className="city-row">
                            <td className="city-row-name">{city.name}</td>
                            <td>{city.abbreviation ?? ''}</td>
                            <td className="actions-col">
                              <button className="btn-edit" onClick={() => navigate('/cities/edit', { state: { item: city } })}>Editar</button>
                              <button className="btn-delete" onClick={() => handleDelete(city)}>Excluir</button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )
                  })}
                </>
              )
            })}
            {totalCities === 0 && (
              <tr><td colSpan={3}>Nenhuma cidade encontrada.</td></tr>
            )}
          </tbody>
        </table>
      )}

    </div>
  )
}
