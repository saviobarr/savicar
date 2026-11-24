import { useState, useEffect } from 'react'
import { fetchAllCustomer, fetchTenantConfig, fetchNfNextNumero, emitirNfse, consultarNfse, previewNfsePdf } from '../api'
import { serverNow } from '../serverClock'

function focusStatus(result) {
  return (result?.focus_response?.status ?? '').toString()
}

function focusErros(result) {
  const resp = result?.focus_response
  if (Array.isArray(resp?.erros)) return resp.erros
  if (resp && typeof resp === 'object' && typeof resp.mensagem === 'string') {
    return [{ codigo: resp.codigo, mensagem: resp.mensagem }]
  }
  return []
}

function isProcessing(result) {
  return focusStatus(result).toLowerCase().includes('processando')
}

function isRejected(result) {
  if (typeof result?.focus_status_code === 'number' && result.focus_status_code >= 400) return true
  if (focusErros(result).length > 0) return true
  const status = focusStatus(result).toLowerCase()
  return ['erro', 'rejeit', 'cancel', 'negad'].some(s => status.includes(s))
}

// url_danfse is the confirmed field for the DANFSE PDF link (verified
// against a real authorized response) — url points at the public
// consultation page instead, not the PDF. The generic scan is a fallback
// for older/unexpected response shapes.
function findLikelyPdfUrl(result) {
  const resp = result?.focus_response
  if (!resp || typeof resp !== 'object') return null
  if (typeof resp.url_danfse === 'string' && resp.url_danfse) return resp.url_danfse
  for (const [key, value] of Object.entries(resp)) {
    if (key === 'url') continue
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value
  }
  return null
}

function customerDisplayName(c) {
  return c.individual_name || c.trade_name || c.legal_name || `Cliente #${c.id_customer}`
}

function todayISOWithOffset() {
  const now = serverNow()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function nowISOForDateTimeLocal() {
  const now = serverNow()
  const pad = n => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

const DEFAULT_CODIGO_MUNICIPIO = '4202404'

const emptyForm = {
  dataEmissao: nowISOForDateTimeLocal(),
  serieDps: '',
  numeroDps: '',
  dataCompetencia: todayISOWithOffset(),
  emitenteDps: '1',
  codigoMunicipioEmissora: DEFAULT_CODIGO_MUNICIPIO,
  cnpjPrestador: '',
  inscricaoMunicipalPrestador: '',
  codigoOpcaoSimplesNacional: '',
  regimeTributarioSimplesNacional: '',
  regimeEspecialTributacao: '',
  cnpjTomador: '',
  razaoSocialTomador: '',
  codigoMunicipioPrestacao: DEFAULT_CODIGO_MUNICIPIO,
  codigoTributacaoNacionalIss: '',
  descricaoServico: '',
  valorServico: '',
  tributacaoIss: '',
  tipoRetencaoIss: '',
  percentualTotalTributosFederais: '',
  percentualTotalTributosEstaduais: '',
  percentualTotalTributosMunicipais: '',
}

function buildPayload(form) {
  const tomadorDoc = form.cnpjTomador.replace(/\D/g, '')
  return {
    data_emissao: form.dataEmissao ? `${form.dataEmissao}:00-03:00` : '',
    serie_dps: form.serieDps.trim(),
    numero_dps: form.numeroDps.trim(),
    data_competencia: form.dataCompetencia,
    emitente_dps: form.emitenteDps.trim(),
    codigo_municipio_emissora: form.codigoMunicipioEmissora.trim(),
    cnpj_prestador: form.cnpjPrestador.replace(/\D/g, ''),
    inscricao_municipal_prestador: form.inscricaoMunicipalPrestador.trim(),
    codigo_opcao_simples_nacional: form.codigoOpcaoSimplesNacional.trim(),
    regime_tributario_simples_nacional: form.regimeTributarioSimplesNacional.trim(),
    regime_especial_tributacao: form.regimeEspecialTributacao.trim(),
    // 11 digits = CPF, anything else is sent as CNPJ
    ...(tomadorDoc.length === 11 ? { cpf_tomador: tomadorDoc } : { cnpj_tomador: tomadorDoc }),
    razao_social_tomador: form.razaoSocialTomador.trim(),
    codigo_municipio_prestacao: form.codigoMunicipioPrestacao.trim(),
    codigo_tributacao_nacional_iss: form.codigoTributacaoNacionalIss.trim(),
    descricao_servico: form.descricaoServico.trim(),
    valor_servico: form.valorServico.trim(),
    tributacao_iss: form.tributacaoIss.trim(),
    tipo_retencao_iss: form.tipoRetencaoIss.trim(),
    percentual_total_tributos_federais: form.percentualTotalTributosFederais.trim(),
    percentual_total_tributos_estaduais: form.percentualTotalTributosEstaduais.trim(),
    percentual_total_tributos_municipais: form.percentualTotalTributosMunicipais.trim(),
  }
}

export default function NfsePage() {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [customers, setCustomers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [consulting, setConsulting] = useState(false)
  const [result, setResult] = useState(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    fetchAllCustomer().then(data => setCustomers(data ?? [])).catch(() => {})
    fetchTenantConfig().then(cfg => {
      if (!cfg) return
      setForm(prev => ({
        ...prev,
        serieDps: cfg.serie_invoice ?? prev.serieDps,
        cnpjPrestador: cfg.tax_id ?? prev.cnpjPrestador,
        inscricaoMunicipalPrestador: cfg.municipal_id ?? prev.inscricaoMunicipalPrestador,
        codigoOpcaoSimplesNacional: cfg.opt_code_simples != null ? String(cfg.opt_code_simples) : prev.codigoOpcaoSimplesNacional,
        regimeTributarioSimplesNacional: cfg.regime_trib_simples_nac != null ? String(cfg.regime_trib_simples_nac) : prev.regimeTributarioSimplesNacional,
        regimeEspecialTributacao: cfg.regime_esp_tributacao != null ? String(cfg.regime_esp_tributacao) : prev.regimeEspecialTributacao,
        codigoTributacaoNacionalIss: cfg.codigo_trib_nac_iss ?? prev.codigoTributacaoNacionalIss,
        tributacaoIss: cfg.tributacao_iss != null ? String(cfg.tributacao_iss) : prev.tributacaoIss,
        tipoRetencaoIss: cfg.tp_iss_retention != null ? String(cfg.tp_iss_retention) : prev.tipoRetencaoIss,
        percentualTotalTributosFederais: cfg.percent_federal_tax != null ? String(cfg.percent_federal_tax) : prev.percentualTotalTributosFederais,
        percentualTotalTributosEstaduais: cfg.percent_state_tax != null ? String(cfg.percent_state_tax) : prev.percentualTotalTributosEstaduais,
        percentualTotalTributosMunicipais: cfg.percent_municipal_tax != null ? String(cfg.percent_municipal_tax) : prev.percentualTotalTributosMunicipais,
      }))
    }).catch(() => {})
    fetchNfNextNumero().then(({ next_numero }) => {
      setForm(prev => ({ ...prev, numeroDps: prev.numeroDps === '' ? String(next_numero) : prev.numeroDps }))
    }).catch(() => {})
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleTomadorNomeChange(e) {
    const value = e.target.value
    const match = customers.find(c => customerDisplayName(c) === value)
    setForm(prev => ({
      ...prev,
      razaoSocialTomador: value,
      cnpjTomador: match?.tax_id ?? prev.cnpjTomador,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setResult(null)
    if (!form.descricaoServico.trim()) { setError('Descrição do serviço é obrigatória.'); return }
    if (!form.razaoSocialTomador.trim()) { setError('Razão social do tomador é obrigatória.'); return }
    if (!form.cnpjTomador.trim()) { setError('CPF/CNPJ do tomador é obrigatório.'); return }
    if (!form.valorServico.trim()) { setError('Valor do serviço é obrigatório.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const data = await emitirNfse(buildPayload(form))
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePreview() {
    setError(null)
    setPreviewing(true)
    try {
      const blob = await previewNfsePdf(buildPayload(form))
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      setError(err.message)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleConsultarNovamente() {
    if (!result?.ref) return
    setConsulting(true)
    setError(null)
    try {
      const data = await consultarNfse(result.ref, form.razaoSocialTomador, form.valorServico)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setConsulting(false)
    }
  }

  return (
    <div className="crud-page">
      <div className="crud-toolbar">
        <h2>NFS-e (Serviços)</h2>
      </div>

      <form onSubmit={handleSubmit} className="crud-form" style={{ maxWidth: 700 }}>
        <h3 style={{ margin: '0 0 8px' }}>Identificação da DPS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Data de Emissão</label>
            <input type="datetime-local" name="dataEmissao" value={form.dataEmissao} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Série</label>
            <input name="serieDps" value={form.serieDps} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Número DPS</label>
            <input name="numeroDps" value={form.numeroDps} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Data de Competência</label>
            <input type="date" name="dataCompetencia" value={form.dataCompetencia} onChange={handleChange} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Emitente DPS</label>
            <input name="emitenteDps" value={form.emitenteDps} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Código Município Emissora</label>
            <input name="codigoMunicipioEmissora" value={form.codigoMunicipioEmissora} onChange={handleChange} />
          </div>
        </div>

        <h3 style={{ margin: '16px 0 8px' }}>Prestador</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>CNPJ Prestador</label>
            <input name="cnpjPrestador" value={form.cnpjPrestador} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Inscrição Municipal Prestador</label>
            <input name="inscricaoMunicipalPrestador" value={form.inscricaoMunicipalPrestador} onChange={handleChange} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Código Opção Simples Nacional</label>
            <input name="codigoOpcaoSimplesNacional" value={form.codigoOpcaoSimplesNacional} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Regime Tributário Simples Nacional</label>
            <input name="regimeTributarioSimplesNacional" value={form.regimeTributarioSimplesNacional} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Regime Especial de Tributação</label>
            <input name="regimeEspecialTributacao" value={form.regimeEspecialTributacao} onChange={handleChange} />
          </div>
        </div>

        <h3 style={{ margin: '16px 0 8px' }}>Tomador</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Nome Tomador</label>
            <input
              name="razaoSocialTomador"
              value={form.razaoSocialTomador}
              onChange={handleTomadorNomeChange}
              list="nfse-customer-list"
              autoComplete="off"
            />
            <datalist id="nfse-customer-list">
              {customers.map(c => (
                <option key={c.id_customer} value={customerDisplayName(c)} />
              ))}
            </datalist>
          </div>
          <div className="form-group">
            <label>CPF/CNPJ Tomador</label>
            <input name="cnpjTomador" value={form.cnpjTomador} onChange={handleChange} />
          </div>
        </div>

        <h3 style={{ margin: '16px 0 8px' }}>Serviço</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Código Município Prestação</label>
            <input name="codigoMunicipioPrestacao" value={form.codigoMunicipioPrestacao} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Código Tributação Nacional ISS</label>
            <input name="codigoTributacaoNacionalIss" value={form.codigoTributacaoNacionalIss} onChange={handleChange} />
          </div>
        </div>
        <div className="form-group">
          <label>Descrição do Serviço</label>
          <input name="descricaoServico" value={form.descricaoServico} onChange={handleChange} autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Valor do Serviço</label>
            <input type="number" step="0.01" name="valorServico" value={form.valorServico} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Tributação ISS</label>
            <input name="tributacaoIss" value={form.tributacaoIss} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Tipo Retenção ISS</label>
            <input name="tipoRetencaoIss" value={form.tipoRetencaoIss} onChange={handleChange} />
          </div>
        </div>

        <h3 style={{ margin: '16px 0 8px' }}>Tributos (%)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>% Total Tributos Federais</label>
            <input type="number" step="0.01" name="percentualTotalTributosFederais" value={form.percentualTotalTributosFederais} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>% Total Tributos Estaduais</label>
            <input type="number" step="0.01" name="percentualTotalTributosEstaduais" value={form.percentualTotalTributosEstaduais} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>% Total Tributos Municipais</label>
            <input type="number" step="0.01" name="percentualTotalTributosMunicipais" value={form.percentualTotalTributosMunicipais} onChange={handleChange} />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="button" onClick={handlePreview} disabled={previewing}>
            {previewing ? 'Gerando prévia...' : 'Pré-visualizar PDF'}
          </button>
          <button type="submit" className="btn-novo" disabled={submitting}>
            {submitting ? 'Emitindo...' : 'Emitir'}
          </button>
        </div>
        {submitting && (
          <p style={{ fontSize: '0.8rem', color: '#888', margin: '8px 0 0' }}>
            Enviando para a Focus NFe e aguardando autorização — a Fazenda processa de forma assíncrona,
            isso pode levar até 1 minuto.
          </p>
        )}
      </form>

      {result && (
        <div className="crud-form" style={{ maxWidth: 700, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 8px', color: isRejected(result) ? '#f87171' : isProcessing(result) ? '#facc15' : '#4ade80' }}>
            {isRejected(result) ? 'Nota rejeitada' : isProcessing(result) ? 'Ainda em processamento' : 'Nota autorizada'}
          </h3>
          <p style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
            <strong>Referência:</strong> {result.ref}
          </p>

          {isRejected(result) && focusErros(result).length > 0 && (
            <ul style={{ color: '#f87171', fontSize: '0.85rem', margin: '0 0 8px', paddingLeft: 18 }}>
              {focusErros(result).map((e, i) => (
                <li key={i}>{e.codigo ? `[${e.codigo}] ` : ''}{e.mensagem}</li>
              ))}
            </ul>
          )}

          {!isRejected(result) && !isProcessing(result) && findLikelyPdfUrl(result) && (
            <p style={{ margin: '0 0 8px' }}>
              <a href={findLikelyPdfUrl(result)} target="_blank" rel="noopener noreferrer" style={{ color: '#f97316' }}>
                Abrir documento
              </a>
            </p>
          )}

          {isProcessing(result) && (
            <button type="button" className="btn-novo" onClick={handleConsultarNovamente} disabled={consulting} style={{ marginBottom: 8 }}>
              {consulting ? 'Consultando...' : 'Consultar novamente'}
            </button>
          )}

          <pre style={{ background: '#0e0f16', padding: 12, borderRadius: 6, overflowX: 'auto', fontSize: '0.85rem', color: '#e2e8f0' }}>
            {JSON.stringify(result.focus_response ?? result.focus_response_raw, null, 2)}
          </pre>

          {isRejected(result) && result.focus_curl && (
            <>
              <p style={{ margin: '8px 0 4px', fontSize: '0.8rem', color: '#94a3b8' }}>curl do envio:</p>
              <pre style={{ background: '#0e0f16', padding: 12, borderRadius: 6, overflowX: 'auto', fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {result.focus_curl}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}
