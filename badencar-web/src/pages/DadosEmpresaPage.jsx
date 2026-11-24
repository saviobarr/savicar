import { useState, useEffect } from 'react'
import SearchSelect from '../components/SearchSelect'
import {
  fetchTenantConfig, updateTenantConfig,
  fetchAllCountry, fetchAllState, fetchAllCity,
} from '../api'


export default function DadosEmpresaPage() {
  const [form, setForm] = useState({
    name: '', exhibition_name: '', tax_id: '',
    address: '', zip_code: '',
    email: '', phone_number: '',
  })
  const [idTenant, setIdTenant]     = useState(null)
  const [countries, setCountries]   = useState([])
  const [states, setStates]         = useState([])
  const [cities, setCities]         = useState([])
  const [selCountry, setSelCountry] = useState('')
  const [selState, setSelState]     = useState('')
  const [selCity, setSelCity]       = useState('')
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(false)

  useEffect(() => {
    Promise.all([fetchTenantConfig(), fetchAllCountry(), fetchAllState(), fetchAllCity()])
      .then(([cfg, allCountries, allStates, allCities]) => {
        // Sort countries alphabetically
        const sorted = [...(allCountries ?? [])].sort((a, b) =>
          (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR')
        )
        setCountries(sorted)
        setStates(allStates ?? [])
        setCities(allCities ?? [])

        if (cfg) {
          setIdTenant(cfg.id_tenant)
          setForm({
            name:            cfg.name            ?? '',
            exhibition_name: cfg.exhibition_name ?? '',
            tax_id:          cfg.tax_id          ?? '',
            address:         cfg.address         ?? '',
            zip_code:        cfg.zip_code        ?? '',
            email:           cfg.email           ?? '',
            phone_number:    cfg.phone_number    ?? '',
          })

          // Derive country and state from the saved city
          if (cfg.id_city) {
            setSelCity(String(cfg.id_city))
            const city = allCities.find(c => c.id_city === cfg.id_city)
            if (city?.id_state) {
              setSelState(String(city.id_state))
              const state = allStates.find(s => s.id_state === city.id_state)
              if (state?.id_country) setSelCountry(String(state.id_country))
            }
          } else {
            // Default to Brasil
            const brasil = sorted.find(c =>
              (c.abbreviation ?? '').toUpperCase() === 'BR' ||
              (c.name ?? '').toUpperCase().includes('BRASIL') ||
              (c.name ?? '').toUpperCase().includes('BRAZIL')
            )
            if (brasil) setSelCountry(String(brasil.id_country))
          }
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filteredStates = selCountry
    ? states.filter(s => s.id_country === Number(selCountry))
    : states

  const filteredCities = selState
    ? cities.filter(c => c.id_state === Number(selState))
    : cities

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleCountryChange(e) {
    setSelCountry(e.target.value)
    setSelState('')
    setSelCity('')
  }

  function handleStateChange(e) {
    setSelState(e.target.value)
    setSelCity('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Razão Social é obrigatória.'); return }
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await updateTenantConfig({
        id_tenant:       idTenant,
        name:            form.name.trim(),
        exhibition_name: form.exhibition_name.trim() || null,
        tax_id:          form.tax_id.trim()          || null,
        address:         form.address.trim()          || null,
        zip_code:        form.zip_code.trim()         || null,
        id_city:         selCity ? Number(selCity) : null,
        email:           form.email.trim()            || null,
        phone_number:    form.phone_number.trim()     || null,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="crud-page"><p className="loading">Carregando...</p></div>

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>Dados da Empresa</h2>
      </div>

      <form onSubmit={handleSubmit} className="crud-form" style={{ maxWidth: 600 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Razão Social</label>
            <input name="name" value={form.name} onChange={handleChange} autoFocus />
          </div>
          <div className="form-group">
            <label>Nome de Exibição</label>
            <input name="exhibition_name" value={form.exhibition_name} onChange={handleChange} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>CNPJ / CPF</label>
            <input name="tax_id" value={form.tax_id} onChange={handleChange} placeholder="00.000.000/0001-00" />
          </div>
          <div className="form-group">
            <label>Telefone</label>
            <input name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="(00) 00000-0000" />
          </div>
        </div>

        <div className="form-group">
          <label>E-mail</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label>Endereço</label>
          <input name="address" value={form.address} onChange={handleChange} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>CEP</label>
            <input name="zip_code" value={form.zip_code} onChange={handleChange} placeholder="00000-000" maxLength={10} />
          </div>
          <div className="form-group">
            <label>País</label>
            <SearchSelect
              options={countries.map(c => ({ value: String(c.id_country), label: c.name ?? '' }))}
              value={selCountry}
              onChange={v => handleCountryChange({ target: { value: v } })}
              placeholder="Digite o país..."
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Estado</label>
            <SearchSelect
              options={filteredStates.map(s => ({ value: String(s.id_state), label: s.abbreviation ? `${s.abbreviation} – ${s.name}` : (s.name ?? '') }))}
              value={selState}
              onChange={v => handleStateChange({ target: { value: v } })}
              placeholder={selCountry ? 'Digite o estado...' : 'Selecione um país primeiro'}
            />
          </div>
          <div className="form-group">
            <label>Cidade</label>
            <select value={selCity} onChange={e => setSelCity(e.target.value)} disabled={!selState}>
              <option value="">— Selecione —</option>
              {filteredCities.map(c => (
                <option key={c.id_city} value={c.id_city}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error   && <p className="error">{error}</p>}
        {success && <p style={{ color: '#4ade80', fontSize: '0.9rem' }}>Dados salvos com sucesso!</p>}

        <div className="form-actions">
          <button type="submit" className="btn-novo" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
