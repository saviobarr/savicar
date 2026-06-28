import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import CrudPage from '../components/CrudPage'
import { makeFormPages } from '../components/CrudFormPage'
import {
  fetchAllCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchAllContact,
  createContact,
  updateContact,
  deleteContact,
  fetchAllCountry,
  fetchAllState,
  fetchAllCity,
  fetchAllCustomerModel,
  createCustomerModel,
  updateCustomerModel,
  deleteCustomerModel,
  fetchAllVehicleMake,
  fetchAllVehicleModel,
  createVehicleModel,
} from '../api'

async function fetchCustomersWithCars() {
  const [customers, allModels] = await Promise.all([fetchAllCustomer(), fetchAllCustomerModel()])
  const byCustomer = {}
  for (const cm of allModels) {
    if (!byCustomer[cm.id_customer]) byCustomer[cm.id_customer] = []
    byCustomer[cm.id_customer].push(cm)
  }
  return customers.map(c => {
    const cars = byCustomer[c.id_customer] ?? []
    let _car_label = ''
    if (cars.length === 1) {
      const car = cars[0]
      _car_label = [car.model_name, car.plate].filter(Boolean).join(' · ')
    } else if (cars.length > 1) {
      _car_label = 'Cliente com mais de um veículo. Clique em Editar'
    }
    return { ...c, _car_label }
  })
}

const FIELDS = [
  { key: 'trade_name', label: 'Nome Fantasia' },
  { key: 'individual_name', label: 'Nome' },
  { key: 'tax_id', label: 'CPF/CNPJ' },
  {
    key: '_car_label',
    label: 'Veículo',
    render: (val) => val
      ? <span style={val.startsWith('Cliente com') ? { color: '#888', fontStyle: 'italic', fontSize: '0.88rem' } : {}}>{val}</span>
      : '',
  },
]

export function CustomerForm({ initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    is_legal_person: initialData?.is_legal_person ?? false,
    is_active: initialData?.is_active ?? true,
    legal_name: initialData?.legal_name ?? '',
    trade_name: initialData?.trade_name ?? '',
    individual_name: initialData?.individual_name ?? '',
    dob: initialData?.dob ? initialData.dob.slice(0, 10) : '',
    gender: initialData?.gender ?? '',
    tax_id: initialData?.tax_id ?? '',
    web_site: initialData?.web_site ?? '',
    state_registration: initialData?.state_registration ?? '',
    municipal_registration: initialData?.municipal_registration ?? '',
  })
  const [dobDisplay, setDobDisplay] = useState(() => {
    const d = initialData?.dob ? initialData.dob.slice(0, 10) : null
    if (!d) return ''
    const parts = d.split('-')
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // ── Contacts ─────────────────────────────────────────────────
  const [contacts, setContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [editingContact, setEditingContact] = useState(null) // null=none, {}=new, {id_contact,...}=existing
  const [contactForm, setContactForm] = useState({
    mobile_phone: '', is_mobile_phone_whatsapp: false, email: '',
    address: '', address_number: '', neighborhood: '',
    id_country: '', id_state: '', id_city: '',
  })
  const [contactSaving, setContactSaving] = useState(false)
  const [contactError, setContactError] = useState(null)

  // ── Vehicles ──────────────────────────────────────────────────
  const [vehicles, setVehicles] = useState([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [makes, setMakes] = useState([])
  const [allModels, setAllModels] = useState([])
  const emptyVehicleForm = { id_make: '', id_model: '', plate: '', year_make: '', year_model: '', color: '', vin: '' }
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [vehicleSaving, setVehicleSaving] = useState(false)
  const [vehicleError, setVehicleError] = useState(null)
  const [showNewModelForm, setShowNewModelForm] = useState(false)
  const [newModelForm, setNewModelForm] = useState({ name: '', version: '' })
  const [newModelSaving, setNewModelSaving] = useState(false)
  const [newModelError, setNewModelError] = useState(null)

  useEffect(() => {
    Promise.all([fetchAllCountry(), fetchAllState(), fetchAllCity(), fetchAllVehicleMake(), fetchAllVehicleModel()])
      .then(([ctrs, sts, cits, mks, mds]) => {
        setCountries(ctrs)
        setStates(sts)
        setCities(cits)
        setMakes(mks)
        setAllModels(mds)
        const brasil = ctrs.find(c => c.name?.trim().toLowerCase() === 'brasil')
        if (brasil) {
          setContactForm(prev => ({ ...prev, id_country: brasil.id_country }))
        }
      })
      .catch(() => {})
    if (!isEdit) return
    setContactsLoading(true)
    fetchAllContact()
      .then(all => setContacts(all.filter(c => c.id_customer === initialData.id_customer)))
      .catch(() => {})
      .finally(() => setContactsLoading(false))
    setVehiclesLoading(true)
    fetchAllCustomerModel()
      .then(all => setVehicles(all.filter(v => v.id_customer === initialData.id_customer)))
      .catch(() => {})
      .finally(() => setVehiclesLoading(false))
  }, [isEdit])

  const emptyContactForm = { mobile_phone: '', is_mobile_phone_whatsapp: false, email: '', address: '', address_number: '', neighborhood: '', id_country: '', id_state: '', id_city: '' }

  function openNewContact() {
    const brasil = countries.find(c => c.name?.trim().toLowerCase() === 'brasil')
    setContactForm({ ...emptyContactForm, id_country: brasil ? brasil.id_country : '' })
    setEditingContact({})
    setContactError(null)
  }

  function openEditContact(c) {
    const cityId = c.id_city ?? ''
    const cityObj = cities.find(x => x.id_city === Number(cityId))
    const stateId = cityObj?.id_state ?? ''
    const stateObj = states.find(x => x.id_state === Number(stateId))
    const countryId = stateObj?.id_country ?? ''
    setContactForm({
      mobile_phone: c.mobile_phone ?? '',
      is_mobile_phone_whatsapp: c.is_mobile_phone_whatsapp ?? false,
      email: c.email ?? '',
      address: c.address ?? '',
      address_number: c.address_number ?? '',
      neighborhood: c.neighborhood ?? '',
      id_country: countryId,
      id_state: stateId,
      id_city: cityId,
    })
    setEditingContact(c)
    setContactError(null)
  }

  function handleContactChange(e) {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value
    if (name === 'id_country') {
      setContactForm(prev => ({ ...prev, id_country: val, id_state: '', id_city: '' }))
    } else if (name === 'id_state') {
      setContactForm(prev => ({ ...prev, id_state: val, id_city: '' }))
    } else {
      setContactForm(prev => ({ ...prev, [name]: val }))
    }
  }

  function buildContactPayload(idCustomer) {
    const { id_country, id_state, ...rest } = contactForm
    return {
      ...rest,
      id_customer: idCustomer ? Number(idCustomer) : null,
      address_number: rest.address_number !== '' ? Number(rest.address_number) : null,
      id_city: rest.id_city !== '' ? Number(rest.id_city) : null,
    }
  }

  async function handleContactSave() {
    setContactSaving(true)
    setContactError(null)
    try {
      if (editingContact.id_contact) {
        const payload = buildContactPayload(initialData.id_customer)
        await updateContact(editingContact.id_contact, payload)
        setContacts(prev => prev.map(c => c.id_contact === editingContact.id_contact ? { ...c, ...payload } : c))
      } else if (isEdit) {
        const created = await createContact(buildContactPayload(initialData.id_customer))
        setContacts(prev => [...prev, created])
      } else {
        setContacts(prev => [...prev, { ...contactForm, _tempId: Date.now() }])
      }
      setEditingContact(null)
    } catch (err) {
      setContactError(err.message)
    } finally {
      setContactSaving(false)
    }
  }

  async function handleContactDelete(c) {
    if (!window.confirm('Excluir contato?')) return
    if (c.id_contact) {
      try {
        await deleteContact(c.id_contact)
        setContacts(prev => prev.filter(x => x.id_contact !== c.id_contact))
      } catch (err) {
        alert('Erro ao excluir: ' + err.message)
      }
    } else {
      setContacts(prev => prev.filter(x => x._tempId !== c._tempId))
    }
  }

  // ── Vehicle handlers ─────────────────────────────────────────
  function openNewVehicle() {
    setVehicleForm(emptyVehicleForm)
    setEditingVehicle({})
    setVehicleError(null)
    setShowNewModelForm(false)
  }

  function openEditVehicle(v) {
    const modelObj = allModels.find(m => String(m.id_model) === String(v.id_model))
    setVehicleForm({
      id_make: modelObj ? String(modelObj.id_make) : '',
      id_model: v.id_model ? String(v.id_model) : '',
      plate: v.plate ?? '',
      year_make: v.year_make ?? '',
      year_model: v.year_model ?? '',
      color: v.color ?? '',
      vin: v.vin ?? '',
    })
    setEditingVehicle(v)
    setVehicleError(null)
    setShowNewModelForm(false)
  }

  function handleVehicleChange(e) {
    const { name, value } = e.target
    if (name === 'id_make') {
      setVehicleForm(prev => ({ ...prev, id_make: value, id_model: '' }))
    } else {
      setVehicleForm(prev => ({ ...prev, [name]: value }))
    }
  }

  function buildVehiclePayload(idCustomer) {
    return {
      id_customer: idCustomer ? Number(idCustomer) : null,
      id_model: vehicleForm.id_model !== '' ? Number(vehicleForm.id_model) : null,
      plate: vehicleForm.plate || null,
      year_make: vehicleForm.year_make !== '' ? Number(vehicleForm.year_make) : null,
      year_model: vehicleForm.year_model !== '' ? Number(vehicleForm.year_model) : null,
      color: vehicleForm.color || null,
      vin: vehicleForm.vin || null,
    }
  }

  async function handleVehicleSave() {
    setVehicleSaving(true)
    setVehicleError(null)
    try {
      if (editingVehicle.id_customer_model) {
        const payload = buildVehiclePayload(initialData.id_customer)
        await updateCustomerModel(editingVehicle.id_customer_model, payload)
        setVehicles(prev => prev.map(v => v.id_customer_model === editingVehicle.id_customer_model ? { ...v, ...payload } : v))
      } else if (isEdit) {
        const created = await createCustomerModel(buildVehiclePayload(initialData.id_customer))
        setVehicles(prev => [...prev, created])
      } else {
        setVehicles(prev => [...prev, { ...vehicleForm, _tempId: Date.now() }])
      }
      setEditingVehicle(null)
    } catch (err) {
      setVehicleError(err.message)
    } finally {
      setVehicleSaving(false)
    }
  }

  async function handleVehicleDelete(v) {
    if (!window.confirm('Excluir veículo?')) return
    if (v.id_customer_model) {
      try {
        await deleteCustomerModel(v.id_customer_model)
        setVehicles(prev => prev.filter(x => x.id_customer_model !== v.id_customer_model))
      } catch (err) {
        alert('Erro ao excluir: ' + err.message)
      }
    } else {
      setVehicles(prev => prev.filter(x => x._tempId !== v._tempId))
    }
  }

  async function handleNewModelSave(e) {
    e.preventDefault()
    e.stopPropagation()
    setNewModelSaving(true)
    setNewModelError(null)
    try {
      const created = await createVehicleModel({
        id_make: Number(vehicleForm.id_make),
        name: newModelForm.name.trim(),
        version: newModelForm.version.trim() || null,
      })
      setAllModels(prev => [...prev, created])
      setVehicleForm(prev => ({ ...prev, id_model: String(created.id_model) }))
      setShowNewModelForm(false)
      setNewModelForm({ name: '', version: '' })
    } catch (err) {
      setNewModelError(err.message)
    } finally {
      setNewModelSaving(false)
    }
  }

  // ── Customer field handlers ───────────────────────────────────
  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleDobChange(e) {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    let display = digits
    if (digits.length > 2) display = digits.slice(0, 2) + '/' + digits.slice(2)
    if (digits.length > 4) display = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
    setDobDisplay(display)
    const parts = display.split('/')
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      setForm(prev => ({ ...prev, dob: `${parts[2]}-${parts[1]}-${parts[0]}` }))
    } else {
      setForm(prev => ({ ...prev, dob: '' }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    e.stopPropagation()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        dob: form.dob !== '' ? form.dob : null,
        gender: form.gender !== '' ? Number(form.gender) : null,
      }
      if (isEdit) {
        await updateCustomer(initialData.id_customer, payload)
        onSaved()
      } else {
        const created = await createCustomer(payload)
        for (const c of contacts) {
          const { _tempId, ...contactData } = c
          await createContact({
            ...contactData,
            id_customer: created.id_customer,
            address_number: contactData.address_number !== '' ? Number(contactData.address_number) : null,
            id_city: contactData.id_city !== '' ? Number(contactData.id_city) : null,
          })
        }
        for (const v of vehicles) {
          const { _tempId, id_make, ...vehicleData } = v
          await createCustomerModel({
            id_customer: created.id_customer,
            id_model: vehicleData.id_model !== '' ? Number(vehicleData.id_model) : null,
            plate: vehicleData.plate || null,
            year_make: vehicleData.year_make !== '' ? Number(vehicleData.year_make) : null,
            year_model: vehicleData.year_model !== '' ? Number(vehicleData.year_model) : null,
            color: vehicleData.color || null,
            vin: vehicleData.vin || null,
          })
        }
        onSaved(created)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const newModelMakeName = makes.find(mk => String(mk.id_make) === String(vehicleForm.id_make))?.name ?? ''

  return (
    <>
    <form onSubmit={handleSubmit} className="crud-form">
      <div className="form-group form-group-check">
        <label>
          <input type="checkbox" name="is_legal_person" checked={form.is_legal_person} onChange={handleChange} />
          {' '}Pessoa Jurídica
        </label>
      </div>
      <div className="form-group form-group-check">
        <label>
          <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
          {' '}Ativo
        </label>
      </div>
      {form.is_legal_person && (
        <>
          <div className="form-group">
            <label>Razão Social</label>
            <input type="text" name="legal_name" value={form.legal_name} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Nome Fantasia</label>
            <input type="text" name="trade_name" value={form.trade_name} onChange={handleChange} />
          </div>
        </>
      )}
      <div className="form-group">
        <label>Nome</label>
        <input type="text" name="individual_name" value={form.individual_name} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Data de Nascimento</label>
        <input type="text" name="dob" value={dobDisplay} onChange={handleDobChange} placeholder="dd/mm/aaaa" maxLength={10} />
      </div>
      <div className="form-group">
        <label>Gênero</label>
        <select name="gender" value={form.gender} onChange={handleChange}>
          <option value="">— Selecione —</option>
          <option value={1}>Masculino</option>
          <option value={2}>Feminino</option>
          <option value={3}>Não-binário</option>
          <option value={4}>Prefere não informar</option>
          <option value={5}>Outro</option>
        </select>
      </div>
      <div className="form-group">
        <label>CPF/CNPJ</label>
        <input type="text" name="tax_id" value={form.tax_id} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Site</label>
        <input type="text" name="web_site" value={form.web_site} onChange={handleChange} />
      </div>
      {form.is_legal_person && (
        <>
          <div className="form-group">
            <label>Inscrição Estadual</label>
            <input type="text" name="state_registration" value={form.state_registration} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Inscrição Municipal</label>
            <input type="text" name="municipal_registration" value={form.municipal_registration} onChange={handleChange} />
          </div>
        </>
      )}

      {/* ── Contacts section ─────────────────────────────────── */}
      <div className="contact-section">
        <div className="contact-section-header">
          <span>Contatos</span>
          <button type="button" className="btn-add-contact" onClick={openNewContact} disabled={editingContact !== null}>
            + Adicionar
          </button>
        </div>
        {contactsLoading && <p className="loading">Carregando contatos...</p>}
        {contacts.map((c, idx) => (
          <div key={c.id_contact ?? c._tempId ?? idx} className="contact-item">
            <div className="contact-item-info">
              {c.mobile_phone && (
                <span>{c.mobile_phone}{c.is_mobile_phone_whatsapp ? ' · WhatsApp' : ''}</span>
              )}
              {c.email && <span>{c.email}</span>}
              {c.address && <span>{c.address}</span>}
            </div>
            <div className="contact-item-actions">
              <button type="button" className="btn-edit" onClick={() => openEditContact(c)}>Editar</button>
              <button type="button" className="btn-delete" onClick={() => handleContactDelete(c)}>Excluir</button>
            </div>
          </div>
        ))}
        {editingContact !== null && (
          <div className="contact-editor">
            <div className="form-group">
              <label>Celular</label>
              <input type="text" name="mobile_phone" value={contactForm.mobile_phone} onChange={handleContactChange} autoFocus />
            </div>
            <div className="form-group form-group-check">
              <label>
                <input type="checkbox" name="is_mobile_phone_whatsapp" checked={contactForm.is_mobile_phone_whatsapp} onChange={handleContactChange} />
                {' '}WhatsApp
              </label>
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input type="email" name="email" value={contactForm.email} onChange={handleContactChange} />
            </div>
            <div className="form-group">
              <label>Endereço</label>
              <input type="text" name="address" value={contactForm.address} onChange={handleContactChange} />
            </div>
            <div className="form-group">
              <label>Número</label>
              <input type="number" name="address_number" value={contactForm.address_number} onChange={handleContactChange} />
            </div>
            <div className="form-group">
              <label>Bairro</label>
              <input type="text" name="neighborhood" value={contactForm.neighborhood} onChange={handleContactChange} />
            </div>
            <div className="form-group">
              <label>País</label>
              <select name="id_country" value={contactForm.id_country} onChange={handleContactChange}>
                <option value="">— Selecione —</option>
                {countries.map(c => (
                  <option key={c.id_country} value={c.id_country}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select name="id_state" value={contactForm.id_state} onChange={handleContactChange} disabled={!contactForm.id_country}>
                <option value="">— Selecione —</option>
                {states
                  .filter(s => String(s.id_country) === String(contactForm.id_country))
                  .map(s => (
                    <option key={s.id_state} value={s.id_state}>{s.abbreviation}</option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <select name="id_city" value={contactForm.id_city} onChange={handleContactChange} disabled={!contactForm.id_state}>
                <option value="">— Selecione —</option>
                {cities
                  .filter(c => String(c.id_state) === String(contactForm.id_state))
                  .map(c => (
                    <option key={c.id_city} value={c.id_city}>{c.name}</option>
                  ))}
              </select>
            </div>
            {contactError && <p className="error">{contactError}</p>}
            <div className="form-actions">
              <button type="button" className="btn-novo" onClick={handleContactSave} disabled={contactSaving}>
                {contactSaving ? 'Salvando...' : 'Salvar contato'}
              </button>
              <button type="button" onClick={() => setEditingContact(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Vehicles section ─────────────────────────────────── */}
      <div className="contact-section">
        <div className="contact-section-header">
          <span>Veículos</span>
          <button type="button" className="btn-add-contact" onClick={openNewVehicle} disabled={editingVehicle !== null}>
            + Adicionar
          </button>
        </div>
        {vehiclesLoading && <p className="loading">Carregando veículos...</p>}
        {vehicles.map((v, idx) => {
          const modelObj = allModels.find(m => String(m.id_model) === String(v.id_model))
          const modelName = v.model_name || (modelObj ? (modelObj.name || '') + (modelObj.version ? ` ${modelObj.version}` : '') : '')
          return (
            <div key={v.id_customer_model ?? v._tempId ?? idx} className="contact-item">
              <div className="contact-item-info">
                {modelName && <span>{modelName}</span>}
                {v.plate && <span>Placa: {v.plate}</span>}
              </div>
              <div className="contact-item-actions">
                <button type="button" className="btn-edit" onClick={() => openEditVehicle(v)}>Editar</button>
                <button type="button" className="btn-delete" onClick={() => handleVehicleDelete(v)}>Excluir</button>
              </div>
            </div>
          )
        })}
        {editingVehicle !== null && (
          <div className="contact-editor">
            <div className="form-group">
              <label>Marca</label>
              <select name="id_make" value={vehicleForm.id_make} onChange={handleVehicleChange}>
                <option value="">— Selecione —</option>
                {makes.map(mk => (
                  <option key={mk.id_make} value={mk.id_make}>{mk.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <div className="contact-section-header" style={{ marginBottom: 4 }}>
                <label style={{ margin: 0 }}>Modelo</label>
                <button
                  type="button"
                  className="btn-add-contact"
                  onClick={() => { setShowNewModelForm(true); setNewModelForm({ name: '', version: '' }); setNewModelError(null) }}
                  disabled={!vehicleForm.id_make || showNewModelForm}
                  title="Cadastrar novo modelo"
                >+</button>
              </div>
              <select name="id_model" value={vehicleForm.id_model} onChange={handleVehicleChange} disabled={!vehicleForm.id_make}>
                <option value="">— Selecione —</option>
                {allModels
                  .filter(m => String(m.id_make) === String(vehicleForm.id_make))
                  .sort((a, b) => {
                    const nameA = `${a.name ?? ''}${a.version ? ` ${a.version}` : ''}`.toLowerCase()
                    const nameB = `${b.name ?? ''}${b.version ? ` ${b.version}` : ''}`.toLowerCase()
                    return nameA.localeCompare(nameB)
                  })
                  .map(m => (
                    <option key={m.id_model} value={m.id_model}>
                      {m.name}{m.version ? ` ${m.version}` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label>Placa</label>
              <input type="text" name="plate" value={vehicleForm.plate} onChange={handleVehicleChange} autoFocus />
            </div>
            <div className="form-group">
              <label>Ano Fabricação</label>
              <input type="number" name="year_make" value={vehicleForm.year_make} onChange={handleVehicleChange} />
            </div>
            <div className="form-group">
              <label>Ano Modelo</label>
              <input type="number" name="year_model" value={vehicleForm.year_model} onChange={handleVehicleChange} />
            </div>
            <div className="form-group">
              <label>Cor</label>
              <input type="text" name="color" value={vehicleForm.color} onChange={handleVehicleChange} />
            </div>
            <div className="form-group">
              <label>Chassi (VIN)</label>
              <input type="text" name="vin" value={vehicleForm.vin} onChange={handleVehicleChange} />
            </div>
            {vehicleError && <p className="error">{vehicleError}</p>}
            <div className="form-actions">
              <button type="button" className="btn-novo" onClick={handleVehicleSave} disabled={vehicleSaving}>
                {vehicleSaving ? 'Salvando...' : 'Salvar veículo'}
              </button>
              <button type="button" onClick={() => setEditingVehicle(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-novo" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
    {showNewModelForm && createPortal(
      <div className="form-modal-overlay" onClick={() => { setShowNewModelForm(false); setNewModelError(null) }}>
        <div className="form-modal" onClick={e => e.stopPropagation()}>
          <div className="form-modal-header">
            <span>Novo Modelo — {newModelMakeName}</span>
            <button className="modal-close" type="button" onClick={() => { setShowNewModelForm(false); setNewModelError(null) }}>✕</button>
          </div>
          <form onSubmit={handleNewModelSave} className="crud-form">
            <div className="form-group">
              <label>Nome</label>
              <input type="text" name="name" value={newModelForm.name} onChange={e => setNewModelForm(prev => ({ ...prev, name: e.target.value }))} autoFocus required />
            </div>
            <div className="form-group">
              <label>Versão</label>
              <input type="text" name="version" value={newModelForm.version} onChange={e => setNewModelForm(prev => ({ ...prev, version: e.target.value }))} />
            </div>
            {newModelError && <p className="error">{newModelError}</p>}
            <div className="form-actions">
              <button type="submit" className="btn-novo" disabled={newModelSaving || !newModelForm.name.trim()}>
                {newModelSaving ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => { setShowNewModelForm(false); setNewModelError(null) }}>Cancelar</button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}

async function deleteCustomerWithContacts(id) {
  const allContacts = await fetchAllContact()
  const customerContacts = allContacts.filter(c => c.id_customer === id)
  await Promise.all(customerContacts.map(c => deleteContact(c.id_contact)))
  await deleteCustomer(id)
}

export const { NewPage: CustomerNewPage, EditPage: CustomerEditPage } = makeFormPages(CustomerForm, 'Clientes', '/customers')

export default function CustomerPage() {
  return (
    <CrudPage
      title="🧑‍🤝‍🧑 Clientes"
      fetchAll={fetchCustomersWithCars}
      deleteItem={deleteCustomerWithContacts}
      fields={FIELDS}
      idKey="id_customer"
      createLabel="+ Novo Cliente"
      FormComponent={CustomerForm}
      filterKeys={['trade_name', 'individual_name', 'tax_id']}
      filterPlaceholder="Filtrar por nome fantasia, nome ou CPF/CNPJ..."
      pageSize={15}
      basePath="/customers"
    />
  )
}
