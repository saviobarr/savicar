import { useEffect, useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { fetchTenantConfig, createWhatsAppInstance, fetchWhatsAppStatus, confirmWhatsApp, disconnectWhatsApp } from '../api'

export default function ConfigurarWhatsAppPage() {
  const [config, setConfig] = useState(null)
  const [qrCode, setQrCode] = useState(null)
  const [status, setStatus] = useState(null) // 'loading' | 'qr' | 'connected' | 'error'
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    fetchTenantConfig()
      .then(setConfig)
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    return () => clearInterval(pollRef.current)
  }, [])

  async function handleCreateInstance() {
    setStatus('loading')
    setError(null)
    try {
      const data = await createWhatsAppInstance()
      setQrCode(data.qrcode_code)
      setStatus('qr')
      startPolling()
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  function startPolling() {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const data = await fetchWhatsAppStatus()
        if (data.state === 'open') {
          clearInterval(pollRef.current)
          await confirmWhatsApp()
          setStatus('connected')
          setConfig(c => ({ ...c, send_wpp: 1 }))
        }
      } catch {
        // keep polling
      }
    }, 3000)
  }

  const [disconnecting, setDisconnecting] = useState(false)

  async function handleDisconnect() {
    if (!window.confirm('Deseja realmente desconectar o WhatsApp? A instância será removida.')) return
    setDisconnecting(true)
    setError(null)
    try {
      await disconnectWhatsApp()
      setConfig(c => ({ ...c, send_wpp: 0 }))
      setStatus(null)
      setQrCode(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setDisconnecting(false)
    }
  }

  const isConnected = config?.send_wpp === 1 || status === 'connected'

  return (
    <div style={{ padding: '2rem', maxWidth: 480 }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Configurar WhatsApp</h2>

      {error && (
        <div style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</div>
      )}

      {isConnected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>WhatsApp conectado!</span>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              padding: '0.6rem 1.4rem',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: disconnecting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.95rem',
              width: 'fit-content',
            }}
          >
            {disconnecting ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
            Clique no botão abaixo para gerar o QR Code e conectar o WhatsApp da oficina.
          </p>

          {status !== 'qr' && (
            <button
              onClick={handleCreateInstance}
              disabled={status === 'loading'}
              style={{
                padding: '0.6rem 1.4rem',
                background: '#25d366',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
              }}
            >
              {status === 'loading' ? 'Aguarde...' : 'Conectar WhatsApp'}
            </button>
          )}

          {status === 'qr' && qrCode && (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#94a3b8' }}>
                Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo e escaneie o QR Code:
              </p>
              <div style={{ background: '#fff', display: 'inline-block', padding: 16, borderRadius: 8 }}>
                <QRCodeSVG value={qrCode} size={256} />
              </div>
              <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                Aguardando escaneamento...
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
