import { useState, useEffect, useRef } from 'react'
import SearchSelect from '../components/SearchSelect'
import {
  fetchTenantConfig, updateTenantConfig, uploadTenantLogo,
  fetchAllCountry, fetchAllState, fetchAllCity,
} from '../api'

const OPT_CODE_SIMPLES_OPTIONS = [
  { value: '1', label: '1 – Não Optante' },
  { value: '2', label: '2 – Optante - Microempreendedor Individual (MEI)' },
  { value: '3', label: '3 – Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)' },
]

const REGIME_ESP_TRIBUTACAO_OPTIONS = [
  { value: '0', label: '0 – Nenhum' },
  { value: '1', label: '1 – Ato Cooperado (Cooperativa)' },
  { value: '2', label: '2 – Estimativa' },
  { value: '3', label: '3 – Microempresa Municipal' },
  { value: '4', label: '4 – Notário ou Registrador' },
  { value: '5', label: '5 – Profissional Autônomo' },
  { value: '6', label: '6 – Sociedade de Profissionais' },
  { value: '9', label: '9 – Outros' },
]

const TRIBUTACAO_ISS_OPTIONS = [
  { value: '1', label: '1 – Operação tributável' },
  { value: '2', label: '2 – Imunidade' },
  { value: '3', label: '3 – Exportação de serviço' },
  { value: '4', label: '4 – Não Incidência' },
]

const REGIME_TRIB_SIMPLES_NAC_OPTIONS = [
  { value: '1', label: '1 – Regime de apuração dos tributos federais e municipal pelo SN' },
  { value: '2', label: '2 – Regime de apuração dos tributos federais pelo SN e ISSQN por fora do SN conforme respectiva legislação municipal do tributo' },
  { value: '3', label: '3 – Regime de apuração dos tributos federais e municipal por fora do SN conforme respectivas legislações federal e municipal de cada tributo' },
]

export default function DadosEmpresaPage() {
  const [form, setForm] = useState({
    name: '', exhibition_name: '', tax_id: '',
    address: '', zip_code: '',
    email: '', phone_number: '',
    api_key_nf: '',
    serie_invoice: '', municipal_id: '', opt_code_simples: '',
    regime_esp_tributacao: '', percent_federal_tax: '', percent_state_tax: '',
    percent_municipal_tax: '', regime_trib_simples_nac: '', codigo_trib_nac_iss: '',
    tributacao_iss: '',
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
  const [logoPath, setLogoPath]     = useState('')
  const [logoVersion, setLogoVersion] = useState(0)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError]   = useState(null)
  const logoFileRef = useRef(null)
  const [view, setView] = useState('geral')

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
            api_key_nf:      cfg.api_key_nf      ?? '',
            serie_invoice:          cfg.serie_invoice          ?? '',
            municipal_id:           cfg.municipal_id           ?? '',
            opt_code_simples:       cfg.opt_code_simples       != null ? String(cfg.opt_code_simples)       : '',
            regime_esp_tributacao:  cfg.regime_esp_tributacao  != null ? String(cfg.regime_esp_tributacao)  : '',
            percent_federal_tax:    cfg.percent_federal_tax    != null ? String(cfg.percent_federal_tax)    : '',
            percent_state_tax:      cfg.percent_state_tax      != null ? String(cfg.percent_state_tax)      : '',
            percent_municipal_tax:  cfg.percent_municipal_tax  != null ? String(cfg.percent_municipal_tax)  : '',
            regime_trib_simples_nac: cfg.regime_trib_simples_nac != null ? String(cfg.regime_trib_simples_nac) : '',
            codigo_trib_nac_iss:    cfg.codigo_trib_nac_iss    ?? '',
            tributacao_iss:         cfg.tributacao_iss         != null ? String(cfg.tributacao_iss)         : '',
          })
          setLogoPath(cfg.logo_path ?? '')

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
        api_key_nf:      form.api_key_nf.trim()       || null,
        serie_invoice:          form.serie_invoice.trim()          || null,
        municipal_id:           form.municipal_id.trim()           || null,
        opt_code_simples:       form.opt_code_simples.trim()       !== '' ? Number(form.opt_code_simples)       : null,
        regime_esp_tributacao:  form.regime_esp_tributacao.trim()  !== '' ? Number(form.regime_esp_tributacao)  : null,
        percent_federal_tax:    form.percent_federal_tax.trim()    !== '' ? Number(form.percent_federal_tax)    : null,
        percent_state_tax:      form.percent_state_tax.trim()      !== '' ? Number(form.percent_state_tax)      : null,
        percent_municipal_tax:  form.percent_municipal_tax.trim()  !== '' ? Number(form.percent_municipal_tax)  : null,
        regime_trib_simples_nac: form.regime_trib_simples_nac.trim() !== '' ? Number(form.regime_trib_simples_nac) : null,
        codigo_trib_nac_iss:    form.codigo_trib_nac_iss.trim()    || null,
        tributacao_iss:         form.tributacao_iss.trim()         !== '' ? Number(form.tributacao_iss)         : null,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingLogo(true)
    setLogoError(null)
    try {
      const result = await uploadTenantLogo(file)
      setLogoPath(result.logo_path ?? '')
      setLogoVersion(v => v + 1)
    } catch (err) {
      setLogoError(err.message)
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  if (loading) return <div className="crud-page"><p className="loading">Carregando...</p></div>

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>Dados da Empresa</h2>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #1e2533', marginBottom: '20px', maxWidth: 600 }}>
        {['geral', 'fiscal'].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            style={{
              padding: '8px 22px',
              background: 'none',
              border: 'none',
              borderBottom: view === v ? '2px solid #e60000' : '2px solid transparent',
              marginBottom: '-2px',
              color: view === v ? '#fff' : '#64748b',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {v === 'geral' ? 'Dados Gerais' : 'Dados Fiscais'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="crud-form" style={{ maxWidth: 600 }}>
        <div style={{ display: view === 'geral' ? 'block' : 'none' }}>
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
        </div>

        <div style={{ display: view === 'fiscal' ? 'block' : 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Série da Nota Fiscal</label>
            <input name="serie_invoice" value={form.serie_invoice} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Inscrição Municipal</label>
            <input name="municipal_id" value={form.municipal_id} onChange={handleChange} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Código Opção Simples Nacional</label>
            <select name="opt_code_simples" value={form.opt_code_simples} onChange={handleChange}>
              <option value="">— Selecione —</option>
              {OPT_CODE_SIMPLES_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Regime Tributário Simples Nacional</label>
            <select name="regime_trib_simples_nac" value={form.regime_trib_simples_nac} onChange={handleChange}>
              <option value="">— Selecione —</option>
              {REGIME_TRIB_SIMPLES_NAC_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Regime Especial de Tributação</label>
            <select name="regime_esp_tributacao" value={form.regime_esp_tributacao} onChange={handleChange}>
              <option value="">— Selecione —</option>
              {REGIME_ESP_TRIBUTACAO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Código Tributação Nacional ISS</label>
            <input name="codigo_trib_nac_iss" value={form.codigo_trib_nac_iss} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Tributação ISS</label>
            <select name="tributacao_iss" value={form.tributacao_iss} onChange={handleChange}>
              <option value="">— Selecione —</option>
              {TRIBUTACAO_ISS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>% Total Tributos Federais</label>
            <input type="number" step="0.01" name="percent_federal_tax" value={form.percent_federal_tax} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>% Total Tributos Estaduais</label>
            <input type="number" step="0.01" name="percent_state_tax" value={form.percent_state_tax} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>% Total Tributos Municipais</label>
            <input type="number" step="0.01" name="percent_municipal_tax" value={form.percent_municipal_tax} onChange={handleChange} />
          </div>
        </div>
        </div>

        <div style={{ display: view === 'geral' ? 'block' : 'none' }}>
        <div className="form-group">
          <label>Logo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {logoPath && (
              <img
                src={`${import.meta.env.VITE_API_URL ?? ''}/tenant-config/logo?v=${logoVersion}`}
                alt="Logo"
                style={{ height: 32, maxWidth: 100, objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            <input value={logoPath} readOnly placeholder="Nenhum logo enviado" style={{ flex: 1, color: '#e2e8f0' }} />
            <button type="button" className="btn-add-contact" onClick={() => logoFileRef.current?.click()} disabled={uploadingLogo} style={{ flexShrink: 0 }}>
              {uploadingLogo ? 'Enviando...' : logoPath ? 'Alterar Logo' : 'Enviar Logo'}
            </button>
            <input ref={logoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
          </div>
          {logoError && <p className="error">{logoError}</p>}
        </div>

        <div className="form-group">
          <label>API Key NF</label>
          <input name="api_key_nf" value={form.api_key_nf} onChange={handleChange} />
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
