import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllNf,
  createNf,
  updateNf,
  deleteNf,
  fetchProdutosNfByNf,
  createProdutoNf,
  updateProdutoNf,
  deleteProdutoNf,
  fetchTenantConfig,
  fetchAllCity,
  fetchAllState,
} from '../api'

function fmtCurrency(val) {
  const n = Number(val)
  if (val === '' || val == null || isNaN(n)) return ''
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(val) {
  if (!val) return ''
  const d = String(val).slice(0, 10)
  const [y, m, day] = d.split('-')
  return y && m && day ? `${day}/${m}/${y}` : d
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const UNIDADE_OPTIONS = [
  { value: 1, label: 'Unidade' },
  { value: 2, label: 'Peça' },
  { value: 3, label: 'Litro' },
  { value: 4, label: 'Metro' },
]

const FIELDS = [
  { key: 'numero', label: 'Número' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'municipio', label: 'Município' },
  { key: 'uf', label: 'UF' },
  { key: 'data_emissao', label: 'Emissão', render: v => fmtDate(v) },
  { key: 'valor_total_nota', label: 'Valor Total', render: v => fmtCurrency(v) },
]

const emptyProdutoForm = {
  descricao: '', unidade: '', quantidade: '', vl_unitario: '', vl_total: '', bc_icms: '', vl_icms: '', aliquota_icms: '',
}

function unidadeLabel(id) {
  return UNIDADE_OPTIONS.find(u => u.value === Number(id))?.label ?? ''
}

function generateChaveAcesso() {
  let s = ''
  for (let i = 0; i < 44; i++) s += Math.floor(Math.random() * 10)
  return s
}

function formatChaveAcesso(chave) {
  const digits = String(chave ?? '').replace(/\D/g, '')
  return digits.match(/.{1,4}/g)?.join(' ') ?? digits
}

function fakeBarcodeSvg(chave) {
  const digits = String(chave ?? '').replace(/\D/g, '') || '0'
  let x = 0
  const bars = []
  for (const ch of digits) {
    const w = 1 + (Number(ch) % 4)
    bars.push(`<rect x="${x}" y="0" width="${w}" height="42" fill="#111" />`)
    x += w + 1
  }
  return `<svg width="${x}" height="42" viewBox="0 0 ${x} 42" xmlns="http://www.w3.org/2000/svg">${bars.join('')}</svg>`
}

async function printNf(win, data, produtos) {
  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const row = (label, value) => value != null && value !== '' ? `<tr><td class="lbl">${label}</td><td>${value}</td></tr>` : ''
  const rowPair = (l1, v1, l2, v2) => `<tr><td class="lbl">${l1}</td><td style="width:35%">${v1 ?? ''}</td><td class="lbl">${l2}</td><td>${v2 ?? ''}</td></tr>`

  const produtosHtml = produtos.length > 0 ? `
    <h3>Produtos</h3>
    <table class="tbl"><thead><tr><th>Descrição</th><th>Unidade</th><th>Qtd</th><th>Valor Unit.</th><th>Valor Total</th></tr></thead><tbody>
    ${produtos.map(p => `<tr>
      <td>${p.descricao ?? ''}</td>
      <td>${unidadeLabel(p.unidade)}</td>
      <td>${p.quantidade ?? ''}</td>
      <td>${p.vl_unitario != null ? fmt(p.vl_unitario) : ''}</td>
      <td>${p.vl_total != null ? fmt(p.vl_total) : ''}</td>
    </tr>`).join('')}
    </tbody></table>` : ''

  const apiBase = import.meta.env.VITE_API_URL ?? ''

  let tenantHtml = ''
  try {
    const [cfg, cities, allStates] = await Promise.all([fetchTenantConfig(), fetchAllCity(), fetchAllState()])
    const city = cfg?.id_city ? cities.find(c => c.id_city === cfg.id_city) : null
    const stateAbbr = city?.id_state ? (allStates.find(s => s.id_state === city.id_state)?.abbreviation ?? '') : ''
    const cityName = city ? [city.name, stateAbbr].filter(Boolean).join(' - ') : ''
    const parts = []
    if (cfg?.exhibition_name) parts.push(`<div style="font-size:15px;font-weight:bold;margin-bottom:2px">${cfg.exhibition_name}</div>`)
    const addrCity = [cfg?.address, cityName].filter(Boolean).join(' — ')
    if (addrCity) parts.push(`<div>${addrCity}</div>`)
    const phoneMail = []
    if (cfg?.phone_number) phoneMail.push(cfg.phone_number)
    if (cfg?.email)        phoneMail.push(cfg.email)
    if (phoneMail.length)  parts.push(`<div>${phoneMail.join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</div>`)
    if (cfg?.tax_id)       parts.push(`<div>CNPJ/CPF: ${cfg.tax_id}</div>`)
    tenantHtml = parts.join('')
  } catch {}

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>NF ${data.numero}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    h3 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    table.info { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: auto; }
    table.info td { padding: 1px 8px 1px 4px; vertical-align: top; }
    table.info td.lbl { font-weight: bold; color: #444; white-space: nowrap; width: 1%; padding-right: 4px; }
    table.tbl { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    table.tbl th, table.tbl td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 11px; }
    table.tbl th { background: #f0f0f0; }
    .totals { margin-top: 12px; }
    .totals table.info { width: auto; }
    .totals table.info td:not(.lbl) { padding-left: 4px; }
    .doc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 12px; }
    .doc-left { display: flex; align-items: flex-start; gap: 20px; }
    .logo { max-height: 70px; }
    .tenant-info { font-size: 11px; color: #333; line-height: 1.7; }
    .doc-right { text-align: center; flex-shrink: 0; }
    .barcode-box svg { display: block; margin: 0 auto; }
    .chave-acesso { margin-top: 4px; font-size: 10px; letter-spacing: 0.5px; font-family: 'Courier New', monospace; }
    .disclaimer { margin-top: 6px; font-size: 10px; color: #900; border: 1px dashed #900; padding: 4px 8px; display: inline-block; }
    @media print { body { margin: 12px; } }
  </style>
  </head><body>
  <div class="doc-header">
    <div class="doc-left">
      <img src="${apiBase}/tenant-config/logo" class="logo" onerror="this.style.display='none'" />
      <div class="tenant-info">${tenantHtml}</div>
    </div>
    <div class="doc-right">
      <div class="barcode-box">${fakeBarcodeSvg(data.chave_acesso)}</div>
      <div class="chave-acesso">${formatChaveAcesso(data.chave_acesso)}</div>
    </div>
  </div>
  <h1>Nota Fiscal Nº ${data.numero}${data.serie ? ` — Série ${data.serie}` : ''}</h1>
  <div class="disclaimer">Documento sem valor fiscal — emissão simulada, não enviada à SEFAZ</div>
  <table class="info" style="margin-top:10px">
    ${rowPair('Natureza da Operação', data.natureza, 'Data de Emissão', fmtDate(data.data_emissao))}
    ${row('Data de Saída', fmtDate(data.data_saida))}
    ${rowPair('CNPJ Destinatário', data.cnpj, 'Inscrição Estadual', data.inscricao_estadual)}
    ${row('Endereço', data.endereco)}
    ${rowPair('Município', data.municipio, 'UF', data.uf)}
    ${row('Protocolo', data.protocolo)}
  </table>
  ${produtosHtml}
  <div class="totals">
    <table class="info">
      ${row('Base ICMS', data.base_icms != null ? fmt(data.base_icms) : '')}
      ${row('Valor ICMS', data.valor_icms != null ? fmt(data.valor_icms) : '')}
      ${row('Base ICMS ST', data.base_icms_st != null ? fmt(data.base_icms_st) : '')}
      ${row('Valor ICMS ST', data.valor_icms_st != null ? fmt(data.valor_icms_st) : '')}
      ${row('Valor Frete', data.valor_frete != null ? fmt(data.valor_frete) : '')}
      ${row('Valor IPI', data.valor_ipi != null ? fmt(data.valor_ipi) : '')}
      ${row('Valor Total dos Produtos', data.valor_total_produtos != null ? fmt(data.valor_total_produtos) : '')}
      ${row('Valor Total da Nota', data.valor_total_nota != null ? fmt(data.valor_total_nota) : '')}
    </table>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`

  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
}

export function NfForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const numero = initialData?.numero

  const [form, setForm] = useState({
    serie: initialData?.serie ?? (isEdit ? '' : 'SERIE1'),
    natureza: initialData?.natureza ?? '',
    chave_acesso: initialData?.chave_acesso ?? '',
    protocolo: initialData?.protocolo ?? '',
    inscricao_estadual: initialData?.inscricao_estadual ?? '',
    cnpj: initialData?.cnpj ?? '',
    endereco: initialData?.endereco ?? '',
    data_emissao: initialData?.data_emissao?.slice(0, 10) ?? (isEdit ? '' : today()),
    data_saida: initialData?.data_saida?.slice(0, 10) ?? (isEdit ? '' : today()),
    municipio: initialData?.municipio ?? '',
    uf: initialData?.uf ?? '',
    base_icms: initialData?.base_icms ?? '',
    valor_icms: initialData?.valor_icms ?? '',
    base_icms_st: initialData?.base_icms_st ?? '',
    valor_icms_st: initialData?.valor_icms_st ?? '',
    valor_frete: initialData?.valor_frete ?? '',
    valor_ipi: initialData?.valor_ipi ?? '',
    valor_total_produtos: initialData?.valor_total_produtos ?? '',
    valor_total_nota: initialData?.valor_total_nota ?? '',
  })
  const [produtos, setProdutos] = useState([])
  const [editingProduto, setEditingProduto] = useState(null)
  const [produtoForm, setProdutoForm] = useState(emptyProdutoForm)
  const [produtoSaving, setProdutoSaving] = useState(false)
  const [produtoError, setProdutoError] = useState(null)
  const [vlUnitarioFocused, setVlUnitarioFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isEdit && numero) {
      fetchProdutosNfByNf(numero).then(data => setProdutos(data ?? [])).catch(() => {})
    }
  }, [isEdit, numero])

  useEffect(() => {
    const unit = parseFloat(String(produtoForm.vl_unitario).replace(',', '.'))
    const qty = parseFloat(String(produtoForm.quantidade).replace(',', '.'))
    if (!isNaN(unit) && !isNaN(qty)) {
      const total = (unit * qty).toFixed(2)
      setProdutoForm(prev => (prev.vl_total === total ? prev : { ...prev, vl_total: total }))
    }
  }, [produtoForm.vl_unitario, produtoForm.quantidade])

  useEffect(() => {
    setProdutoForm(prev => (prev.bc_icms === prev.vl_total ? prev : { ...prev, bc_icms: prev.vl_total }))
  }, [produtoForm.vl_total])

  useEffect(() => {
    const base = parseFloat(String(produtoForm.bc_icms).replace(',', '.'))
    const aliquota = parseFloat(String(produtoForm.aliquota_icms).replace(',', '.'))
    if (!isNaN(base) && !isNaN(aliquota)) {
      const valor = (base * aliquota / 100).toFixed(2)
      setProdutoForm(prev => (prev.vl_icms === valor ? prev : { ...prev, vl_icms: valor }))
    }
  }, [produtoForm.bc_icms, produtoForm.aliquota_icms])

  useEffect(() => {
    const totalProdutos = produtos.reduce((acc, p) => acc + (Number(p.vl_total) || 0), 0)
    const totalIcms = produtos.reduce((acc, p) => acc + (Number(p.vl_icms) || 0), 0)
    setForm(prev => ({
      ...prev,
      base_icms: totalProdutos ? totalProdutos.toFixed(2) : '',
      valor_icms: totalIcms ? totalIcms.toFixed(2) : '',
    }))
  }, [produtos])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleProdutoChange(e) {
    setProdutoForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function openNewProduto() {
    setProdutoForm(emptyProdutoForm)
    setProdutoError(null)
    setEditingProduto({})
  }

  function openEditProduto(p) {
    setProdutoForm({
      descricao: p.descricao ?? '',
      unidade: p.unidade ?? '',
      quantidade: p.quantidade ?? '',
      vl_unitario: p.vl_unitario ?? '',
      vl_total: p.vl_total ?? '',
      bc_icms: p.bc_icms ?? '',
      vl_icms: p.vl_icms ?? '',
      aliquota_icms: p.aliquota_icms ?? '',
    })
    setProdutoError(null)
    setEditingProduto(p)
  }

  function buildProdutoPayload(nfNumero) {
    return {
      numero: nfNumero,
      descricao: produtoForm.descricao || null,
      unidade: produtoForm.unidade !== '' ? Number(produtoForm.unidade) : null,
      quantidade: produtoForm.quantidade !== '' ? Number(produtoForm.quantidade) : null,
      vl_unitario: produtoForm.vl_unitario || null,
      vl_total: produtoForm.vl_total || null,
      bc_icms: produtoForm.bc_icms || null,
      vl_icms: produtoForm.vl_icms || null,
      aliquota_icms: produtoForm.aliquota_icms || null,
    }
  }

  async function handleProdutoSave() {
    if (!produtoForm.descricao) {
      setProdutoError('Informe a descrição do produto.')
      return
    }
    setProdutoSaving(true)
    setProdutoError(null)
    try {
      if (editingProduto.id_produto) {
        const updated = await updateProdutoNf(editingProduto.id_produto, buildProdutoPayload(numero))
        setProdutos(prev => prev.map(p => p.id_produto === editingProduto.id_produto ? updated : p))
      } else if (isEdit) {
        const created = await createProdutoNf(buildProdutoPayload(numero))
        setProdutos(prev => [...prev, created])
      } else {
        setProdutos(prev => [...prev, { ...produtoForm, _tempId: Date.now() }])
      }
      setEditingProduto(null)
    } catch (err) {
      setProdutoError(err.message)
    } finally {
      setProdutoSaving(false)
    }
  }

  async function handleProdutoDelete(p) {
    if (p.id_produto) {
      try {
        await deleteProdutoNf(p.id_produto)
      } catch (err) {
        setError(err.message)
        return
      }
    }
    setProdutos(prev => prev.filter(x => x !== p))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // Open the print window synchronously, in the same tick as the click,
    // so the browser doesn't treat it as a blocked popup once the saves below finish.
    const printWin = window.open('', '_blank')
    if (printWin) {
      printWin.document.write('<p style="font-family:sans-serif;padding:20px">Gerando nota fiscal...</p>')
    }
    setSaving(true)
    setError(null)
    try {
      const somaProdutos = produtos.reduce((acc, p) => acc + (Number(p.vl_total) || 0), 0)
      const payload = {
        ...form,
        chave_acesso: form.chave_acesso || generateChaveAcesso(),
        valor_total_produtos: form.valor_total_produtos || (somaProdutos ? String(somaProdutos) : null),
      }
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })

      let saved
      if (isEdit) {
        saved = await updateNf(numero, payload)
      } else {
        saved = await createNf(payload)
        for (const p of produtos) {
          await createProdutoNf({
            numero: saved.numero,
            descricao: p.descricao || null,
            unidade: p.unidade !== '' ? Number(p.unidade) : null,
            quantidade: p.quantidade !== '' ? Number(p.quantidade) : null,
            vl_unitario: p.vl_unitario || null,
            vl_total: p.vl_total || null,
            bc_icms: p.bc_icms || null,
            vl_icms: p.vl_icms || null,
            aliquota_icms: p.aliquota_icms || null,
          })
        }
      }
      if (!printWin) {
        window.alert('Nota fiscal salva, mas o navegador bloqueou a abertura da impressão. Permita pop-ups para este site.')
      } else {
        await printNf(printWin, saved, produtos)
      }
      onSaved()
    } catch (err) {
      if (printWin) printWin.close()
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="crud-form">
      <div className="form-group">
        <label>Série</label>
        <input type="text" name="serie" value={form.serie} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Natureza da Operação</label>
        <input type="text" name="natureza" value={form.natureza} onChange={handleChange} placeholder="Venda de mercadoria" />
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Data de Emissão</label>
          <input type="date" name="data_emissao" value={form.data_emissao} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Data de Saída</label>
          <input type="date" name="data_saida" value={form.data_saida} onChange={handleChange} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>CNPJ do Destinatário</label>
          <input type="text" name="cnpj" value={form.cnpj} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Inscrição Estadual</label>
          <input type="text" name="inscricao_estadual" value={form.inscricao_estadual} onChange={handleChange} />
        </div>
      </div>
      <div className="form-group">
        <label>Endereço</label>
        <input type="text" name="endereco" value={form.endereco} onChange={handleChange} />
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Município</label>
          <input type="text" name="municipio" value={form.municipio} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>UF</label>
          <select name="uf" value={form.uf} onChange={handleChange}>
            <option value="">Selecione...</option>
            {UF_OPTIONS.map(uf => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Base ICMS</label>
          <input type="text" value={fmtCurrency(form.base_icms)} readOnly />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Valor ICMS</label>
          <input type="text" value={fmtCurrency(form.valor_icms)} readOnly />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Base ICMS ST</label>
          <input type="text" name="base_icms_st" value={form.base_icms_st} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Valor ICMS ST</label>
          <input type="text" name="valor_icms_st" value={form.valor_icms_st} onChange={handleChange} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Valor Frete</label>
          <input type="text" name="valor_frete" value={form.valor_frete} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Valor IPI</label>
          <input type="text" name="valor_ipi" value={form.valor_ipi} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Valor Total dos Produtos</label>
          <input
            type="text" name="valor_total_produtos" value={form.valor_total_produtos} onChange={handleChange}
            placeholder={produtos.length ? String(produtos.reduce((acc, p) => acc + (Number(p.vl_total) || 0), 0)) : ''}
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Valor Total da Nota</label>
          <input type="text" name="valor_total_nota" value={form.valor_total_nota} onChange={handleChange} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Chave de Acesso</label>
          <input type="text" name="chave_acesso" value={form.chave_acesso} onChange={handleChange} placeholder="Preenchido na emissão (fake)" />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Protocolo</label>
          <input type="text" name="protocolo" value={form.protocolo} onChange={handleChange} placeholder="Preenchido na emissão (fake)" />
        </div>
      </div>

      {/* ── Produtos section ─────────────────────────────────── */}
      <div className="contact-section">
        <div className="contact-section-header">
          <span>Produtos</span>
          <button type="button" className="btn-add-contact" onClick={openNewProduto}>
            + Adicionar
          </button>
        </div>

        {produtoError && editingProduto === null && <p className="error">{produtoError}</p>}

        {produtos.length > 0 && (
          <table className="services-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Unidade</th>
                <th>Qtd</th>
                <th>Vl. Unit.</th>
                <th>Vl. Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p, idx) => (
                <tr key={p.id_produto ?? p._tempId ?? idx}>
                  <td>{p.descricao}</td>
                  <td>{unidadeLabel(p.unidade)}</td>
                  <td>{p.quantidade}</td>
                  <td>{fmtCurrency(p.vl_unitario)}</td>
                  <td>{fmtCurrency(p.vl_total)}</td>
                  <td className="actions-col">
                    <button type="button" className="btn-edit" onClick={() => openEditProduto(p)}>Editar</button>
                    <button type="button" className="btn-delete" onClick={() => handleProdutoDelete(p)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {editingProduto !== null && createPortal(
          <div className="form-modal-overlay" onClick={() => setEditingProduto(null)}>
            <div className="form-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className="form-modal-header">
                <span>{editingProduto.id_produto ? 'Editar Produto' : 'Novo Produto'}</span>
                <button className="modal-close" onClick={() => setEditingProduto(null)}>✕</button>
              </div>
              <div style={{ padding: '1rem' }}>
                <div className="form-group">
                  <label>Descrição</label>
                  <input type="text" name="descricao" value={produtoForm.descricao} onChange={handleProdutoChange} />
                </div>
                <div className="form-group">
                  <label>Unidade</label>
                  <select name="unidade" value={produtoForm.unidade} onChange={handleProdutoChange}>
                    <option value="">Selecione...</option>
                    {UNIDADE_OPTIONS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantidade</label>
                  <input type="number" step="1" min="0" name="quantidade" value={produtoForm.quantidade} onChange={handleProdutoChange} />
                </div>
                <div className="form-group">
                  <label>Valor Unitário</label>
                  <input
                    type="text"
                    name="vl_unitario"
                    value={vlUnitarioFocused ? (produtoForm.vl_unitario ?? '') : fmtCurrency(produtoForm.vl_unitario)}
                    placeholder="R$ 0,00"
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
                      setProdutoForm(prev => ({ ...prev, vl_unitario: raw }))
                    }}
                    onFocus={() => setVlUnitarioFocused(true)}
                    onBlur={() => {
                      setVlUnitarioFocused(false)
                      const num = parseFloat(String(produtoForm.vl_unitario).replace(',', '.'))
                      setProdutoForm(prev => ({ ...prev, vl_unitario: isNaN(num) ? '' : String(num) }))
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Valor Total</label>
                  <input type="text" value={fmtCurrency(produtoForm.vl_total)} readOnly />
                </div>
                <div className="form-group">
                  <label>Base ICMS</label>
                  <input type="text" value={fmtCurrency(produtoForm.bc_icms)} readOnly />
                </div>
                <div className="form-group">
                  <label>Alíquota ICMS (%)</label>
                  <input type="number" step="any" name="aliquota_icms" value={produtoForm.aliquota_icms} onChange={handleProdutoChange} />
                </div>
                <div className="form-group">
                  <label>Valor ICMS</label>
                  <input type="text" value={fmtCurrency(produtoForm.vl_icms)} readOnly />
                </div>
                {produtoError && <p className="error">{produtoError}</p>}
                <div className="form-actions">
                  <button type="button" className="btn-novo" onClick={handleProdutoSave} disabled={produtoSaving}>
                    {produtoSaving ? 'Salvando...' : 'Salvar produto'}
                  </button>
                  <button type="button" onClick={() => setEditingProduto(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Emitindo...' : 'Emitir'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export const { NewPage: NfNewPage, EditPage: NfEditPage } = makeFormPages(NfForm, 'Notas Fiscais', '/nf')

export default function NfPage() {
  return (
    <CrudPage
      title="📄 Notas Fiscais"
      fetchAll={fetchAllNf}
      deleteItem={deleteNf}
      fields={FIELDS}
      FormComponent={NfForm}
      idKey="numero"
      filterKeys={['numero', 'cnpj', 'municipio']}
      filterPlaceholder="Filtrar por número, CNPJ ou município..."
      basePath="/nf"
    />
  )
}
