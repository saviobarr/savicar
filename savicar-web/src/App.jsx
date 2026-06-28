import { useState } from 'react'
import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import { getToken, clearToken, getProfile, clearProfile, clearUserId } from './api'

const PROFILE_TECNICO = 3

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />
}
import RelatorioPagamentosPage from './pages/RelatorioPagamentosPage'
import ImagensOS from './pages/ImagensOS'
import VehicleMakePage, { VehicleMakeNewPage, VehicleMakeEditPage } from './pages/VehicleMakePage'
import FuelPage, { FuelNewPage, FuelEditPage } from './pages/FuelPage'
import TechnicianPage, { TechnicianNewPage, TechnicianEditPage } from './pages/TechnicianPage'
import VehicleModelPage, { VehicleModelNewPage, VehicleModelEditPage } from './pages/VehicleModelPage'
import CustomerPage, { CustomerNewPage, CustomerEditPage } from './pages/CustomerPage'
import ContactPage, { ContactNewPage, ContactEditPage } from './pages/ContactPage'
import CustomerModelPage, { CustomerModelNewPage, CustomerModelEditPage } from './pages/CustomerModelPage'
import InventoryPage, { InventoryNewPage, InventoryEditPage } from './pages/InventoryPage'
import ServiceOrderPage, { ServiceOrderNewPage, ServiceOrderEditPage } from './pages/ServiceOrderPage'
import ServicesPage, { ServicesNewPage, ServicesEditPage } from './pages/ServicesPage'
import ServiceOrderProductPage, { ServiceOrderProductNewPage, ServiceOrderProductEditPage } from './pages/ServiceOrderProductPage'
import CountryPage, { CountryNewPage, CountryEditPage } from './pages/CountryPage'
import StatePage, { StateNewPage, StateEditPage } from './pages/StatePage'
import CityPage, { CityNewPage, CityEditPage } from './pages/CityPage'
import UnityPage, { UnityNewPage, UnityEditPage } from './pages/UnityPage'
import ResourcePage, { ResourceNewPage, ResourceEditPage } from './pages/ResourcePage'
import ServiceAppointmentPage, { ServiceAppointmentNewPage, ServiceAppointmentEditPage } from './pages/ServiceAppointmentPage'
import OperationalCostsPage, { OperationalCostNewPage, OperationalCostEditPage } from './pages/OperationalCostsPage'
import RelatorioOperacaoPage from './pages/RelatorioOperacaoPage'
import ConfigurarWhatsAppPage from './pages/ConfigurarWhatsAppPage'
import DadosEmpresaPage from './pages/DadosEmpresaPage'
import UsersPage, { UserNewPage, UserEditPage } from './pages/UsersPage'
import AuditPage from './pages/AuditPage'
import './App.css'

const NAV_LINKS = [
  { to: '/appointments', label: 'Agendamento', highlight: true },
  { to: '/service-orders', label: 'Ordens de Serviço' },
  { to: '/inventory', label: 'Estoque' },
  { to: '/technicians', label: 'Técnicos' },
  {
    label: 'Clientes',
    children: [
      { to: '/customers', label: 'Clientes' },
      { to: '/customer-models', label: 'Veículos do Cliente' },
    ],
  },
  { to: '/resources', label: 'Recursos' },
]

const AUX_LINKS = [
  { to: '/makes', label: 'Marcas' },
  { to: '/fuels', label: 'Combustíveis' },
  { to: '/models', label: 'Modelos' },
  { to: '/countries', label: 'Países' },
  { to: '/states', label: 'Estados' },
  { to: '/cities', label: 'Cidades' },
  { to: '/unities', label: 'Unidades' },
]

function AppShell() {
  const [auxOpen, setAuxOpen] = useState(false)
  const [finOpen, setFinOpen] = useState(false)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const toggleGroup = label => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  const profile = getProfile()
  const isTecnico = profile === PROFILE_TECNICO

  function handleLogout() {
    clearToken()
    clearProfile()
    clearUserId()
    window.location.href = '/login'
  }

  return (
    <div className="layout">
      <aside className={`sidebar${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
        <div className="sidebar-logo">
          {sidebarOpen && <img src={`${import.meta.env.VITE_API_URL ?? ''}/tenant-config/logo`} alt="Logo" />}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        {sidebarOpen && <nav>
          {(isTecnico ? NAV_LINKS.filter(l => l.to === '/service-orders') : NAV_LINKS).map(({ to, label, highlight, children }) =>
            children ? (
              <div key={label}>
                <button
                  className={`nav-group-toggle${openGroups[label] ? ' open' : ''}`}
                  onClick={() => toggleGroup(label)}
                >
                  <span>{label}</span>
                  <span className="nav-group-arrow">{openGroups[label] ? '▾' : '▸'}</span>
                </button>
                {openGroups[label] && (
                  <div className="nav-group-items">
                    {children.map(({ to, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) => isActive ? 'nav-sublink active' : 'nav-sublink'}
                      >
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [isActive ? 'nav-link active' : 'nav-link', highlight ? 'nav-link-highlight' : ''].join(' ').trim()
                }
              >
                {label}
              </NavLink>
            )
          )}

          {!isTecnico && <>
          <button
            className={`nav-group-toggle${finOpen ? ' open' : ''}`}
            onClick={() => setFinOpen(o => !o)}
          >
            <span>Financeiro</span>
            <span className="nav-group-arrow">{finOpen ? '▾' : '▸'}</span>
          </button>
          {finOpen && (
            <div className="nav-group-items">
              <NavLink
                to="/financeiro/operacao"
                className={({ isActive }) => isActive ? 'nav-sublink active' : 'nav-sublink'}
              >
                Custos Operacionais
              </NavLink>
              <NavLink
                to="/relatorios/financeiro/pagamentos"
                className={({ isActive }) => isActive ? 'nav-sublink active' : 'nav-sublink'}
              >
                Pagamentos/Recebimentos
              </NavLink>
              <NavLink
                to="/relatorios/financeiro/resultado-os"
                className={({ isActive }) => isActive ? 'nav-sublink active' : 'nav-sublink'}
              >
                Resultado do Período
              </NavLink>
            </div>
          )}

          <button
            className={`nav-group-toggle${cfgOpen ? ' open' : ''}`}
            onClick={() => setCfgOpen(o => !o)}
          >
            <span>Configurações</span>
            <span className="nav-group-arrow">{cfgOpen ? '▾' : '▸'}</span>
          </button>
          {cfgOpen && (
            <div className="nav-group-items">
              <NavLink
                to="/configuracoes/dados-empresa"
                className={({ isActive }) => isActive ? 'nav-sublink active' : 'nav-sublink'}
              >
                Dados da Empresa
              </NavLink>
              <NavLink
                to="/configuracoes/whatsapp"
                className={({ isActive }) => isActive ? 'nav-sublink active' : 'nav-sublink'}
              >
                Configurar WhatsApp
              </NavLink>
              <NavLink
                to="/users"
                className={({ isActive }) => isActive ? 'nav-sublink active' : 'nav-sublink'}
              >
                Usuários
              </NavLink>
              <NavLink
                to="/audit"
                className={({ isActive }) => isActive ? 'nav-sublink active' : 'nav-sublink'}
              >
                Auditoria
              </NavLink>
            </div>
          )}

          <button
            className={`nav-group-toggle${auxOpen ? ' open' : ''}`}
            onClick={() => setAuxOpen(o => !o)}
          >
            <span>Cadastros Auxiliares</span>
            <span className="nav-group-arrow">{auxOpen ? '▾' : '▸'}</span>
          </button>
          {auxOpen && (
            <div className="nav-group-items">
              {AUX_LINKS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => isActive ? 'nav-sublink active' : 'nav-sublink'}
                >
                  {label}
                </NavLink>
              ))}
            </div>
          )}
          </>}

          {sidebarOpen && (
            <button
              onClick={handleLogout}
              style={{
                margin: '8px 12px 4px',
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textAlign: 'left',
                width: 'calc(100% - 24px)',
              }}
            >
              Sair
            </button>
          )}
        </nav>}
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/service-orders" replace />} />

          <Route path="/makes/new" element={<VehicleMakeNewPage />} />
          <Route path="/makes/edit" element={<VehicleMakeEditPage />} />
          <Route path="/makes" element={<VehicleMakePage />} />

          <Route path="/fuels/new" element={<FuelNewPage />} />
          <Route path="/fuels/edit" element={<FuelEditPage />} />
          <Route path="/fuels" element={<FuelPage />} />

          <Route path="/technicians/new" element={<TechnicianNewPage />} />
          <Route path="/technicians/edit" element={<TechnicianEditPage />} />
          <Route path="/technicians" element={<TechnicianPage />} />

          <Route path="/models/new" element={<VehicleModelNewPage />} />
          <Route path="/models/edit" element={<VehicleModelEditPage />} />
          <Route path="/models" element={<VehicleModelPage />} />

          <Route path="/customers/new" element={<CustomerNewPage />} />
          <Route path="/customers/edit" element={<CustomerEditPage />} />
          <Route path="/customers" element={<CustomerPage />} />

          <Route path="/contacts/new" element={<ContactNewPage />} />
          <Route path="/contacts/edit" element={<ContactEditPage />} />
          <Route path="/contacts" element={<ContactPage />} />

          <Route path="/customer-models/new" element={<CustomerModelNewPage />} />
          <Route path="/customer-models/edit" element={<CustomerModelEditPage />} />
          <Route path="/customer-models" element={<CustomerModelPage />} />

          <Route path="/inventory/new" element={<InventoryNewPage />} />
          <Route path="/inventory/edit" element={<InventoryEditPage />} />
          <Route path="/inventory" element={<InventoryPage />} />

          <Route path="/service-orders/new" element={<ServiceOrderNewPage />} />
          <Route path="/service-orders/edit" element={<ServiceOrderEditPage />} />
          <Route path="/service-orders" element={<ServiceOrderPage />} />

          <Route path="/services/new" element={<ServicesNewPage />} />
          <Route path="/services/edit" element={<ServicesEditPage />} />
          <Route path="/services" element={<ServicesPage />} />

          <Route path="/service-order-products/new" element={<ServiceOrderProductNewPage />} />
          <Route path="/service-order-products/edit" element={<ServiceOrderProductEditPage />} />
          <Route path="/service-order-products" element={<ServiceOrderProductPage />} />

          <Route path="/countries/new" element={<CountryNewPage />} />
          <Route path="/countries/edit" element={<CountryEditPage />} />
          <Route path="/countries" element={<CountryPage />} />

          <Route path="/states/new" element={<StateNewPage />} />
          <Route path="/states/edit" element={<StateEditPage />} />
          <Route path="/states" element={<StatePage />} />

          <Route path="/cities/new" element={<CityNewPage />} />
          <Route path="/cities/edit" element={<CityEditPage />} />
          <Route path="/cities" element={<CityPage />} />

          <Route path="/appointments/new" element={<ServiceAppointmentNewPage />} />
          <Route path="/appointments/edit" element={<ServiceAppointmentEditPage />} />
          <Route path="/appointments" element={<ServiceAppointmentPage />} />

          <Route path="/unities/new" element={<UnityNewPage />} />
          <Route path="/unities/edit" element={<UnityEditPage />} />
          <Route path="/unities" element={<UnityPage />} />

          <Route path="/resources/new" element={<ResourceNewPage />} />
          <Route path="/resources/edit" element={<ResourceEditPage />} />
          <Route path="/resources" element={<ResourcePage />} />

          <Route path="/financeiro/operacao/new" element={<OperationalCostNewPage />} />
          <Route path="/financeiro/operacao/edit" element={<OperationalCostEditPage />} />
          <Route path="/financeiro/operacao" element={<OperationalCostsPage />} />

          <Route path="/imagens-os" element={<ImagensOS />} />
          <Route path="/relatorios/financeiro/pagamentos" element={<RelatorioPagamentosPage />} />
          <Route path="/relatorios/financeiro/resultado-os" element={<RelatorioOperacaoPage />} />

          <Route path="/configuracoes/dados-empresa" element={<DadosEmpresaPage />} />
          <Route path="/configuracoes/whatsapp" element={<ConfigurarWhatsAppPage />} />

          <Route path="/users/new" element={<UserNewPage />} />
          <Route path="/users/edit" element={<UserEditPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<PrivateRoute><AppShell /></PrivateRoute>} />
    </Routes>
  )
}
