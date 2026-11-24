import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { fetchImagesByOrder, fetchImageBlob, sendServiceOrderImagesWhatsApp } from '../api'

export default function ServiceOrderMediaTab({ orderId, customerName }) {
  const [images, setImages] = useState([])
  const [blobUrls, setBlobUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [lightbox, setLightbox] = useState(null)
  const [sendOpen, setSendOpen] = useState(false)

  // The file route needs auth, which a plain <img src> can't send, so each
  // file is fetched as a blob and rendered from an object URL instead —
  // revoked on unmount/order change so they don't leak.
  useEffect(() => {
    let cancelled = false
    const urls = []
    setLoading(true)
    setError(null)
    setBlobUrls({})

    fetchImagesByOrder(orderId)
      .then(async data => {
        if (cancelled) return
        setImages(data ?? [])
        const map = {}
        await Promise.all((data ?? []).map(async img => {
          try {
            const blob = await fetchImageBlob(img.id_image)
            if (cancelled) return
            const url = URL.createObjectURL(blob)
            urls.push(url)
            map[img.id_image] = url
          } catch {
            // leave unset — thumbnail falls back to a placeholder
          }
        }))
        if (!cancelled) setBlobUrls(map)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true; urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [orderId])

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(images.map(i => i.id_image)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  return (
    <div className="contact-section" style={{ marginTop: 16 }}>
      {loading && <p style={{ fontSize: '0.85rem', color: '#888' }}>Carregando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && images.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#888' }}>Nenhuma foto ou vídeo nesta OS.</p>
      )}

      {!loading && images.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {selected.size > 0 ? `${selected.size} selecionada(s)` : `${images.length} arquivo(s)`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {selected.size > 0 ? (
                <button type="button" onClick={clearSelection}>Limpar seleção</button>
              ) : (
                <button type="button" onClick={selectAll}>Selecionar todas</button>
              )}
              <button
                type="button"
                className="btn-novo"
                style={{ background: '#25d366' }}
                disabled={selected.size === 0}
                onClick={() => setSendOpen(true)}
              >
                Enviar por WhatsApp
              </button>
            </div>
          </div>

          <div className="product-images-grid">
            {images.map(img => {
              const isVideo = !img.image_path && !!img.video_path
              const checked = selected.has(img.id_image)
              const url = blobUrls[img.id_image]
              return (
                <div
                  key={img.id_image}
                  className="product-image-thumb"
                  style={{ outline: checked ? '2px solid #e60000' : 'none' }}
                >
                  {!url ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#64748b', textAlign: 'center', padding: 4 }}>
                      {isVideo ? '🎬' : 'indisponível'}
                    </div>
                  ) : isVideo ? (
                    <video
                      src={url}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onClick={() => setLightbox(img)}
                    />
                  ) : (
                    <img src={url} alt="" onClick={() => setLightbox(img)} />
                  )}
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(img.id_image)}
                    onClick={e => e.stopPropagation()}
                    style={{ position: 'absolute', top: 4, left: 4, width: 16, height: 16, cursor: 'pointer' }}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}

      {lightbox && createPortal(
        <div className="modal-overlay" onClick={() => setLightbox(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setLightbox(null)}>✕</button>
            {(!lightbox.image_path && lightbox.video_path) ? (
              <video src={blobUrls[lightbox.id_image]} controls autoPlay style={{ maxWidth: '100%', maxHeight: '80vh' }} />
            ) : (
              <img src={blobUrls[lightbox.id_image]} alt="Imagem ampliada" />
            )}
          </div>
        </div>,
        document.body
      )}

      {sendOpen && (
        <SendMediaModal
          orderId={orderId}
          customerName={customerName}
          imageIds={[...selected]}
          onClose={() => setSendOpen(false)}
          onSent={clearSelection}
        />
      )}
    </div>
  )
}

function SendMediaModal({ orderId, customerName, imageIds, onClose, onSent }) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [phoneNeeded, setPhoneNeeded] = useState(null) // null | 'no_phone' | 'invalid_whatsapp_number'
  const [phoneNeededMessage, setPhoneNeededMessage] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [sent, setSent] = useState(null)

  async function handleSend(phoneOverride) {
    setSending(true)
    setError(null)
    try {
      const result = await sendServiceOrderImagesWhatsApp(orderId, imageIds, phoneOverride ?? '')
      setSent(result)
    } catch (e) {
      if (e.code === 'no_phone' || e.code === 'invalid_whatsapp_number') {
        setPhoneNeeded(e.code)
        setPhoneNeededMessage(e.message)
        setSending(false)
        return
      }
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return createPortal(
    <div className="form-modal-overlay" onClick={onClose}>
      <div className="form-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="form-modal-header">
          <span>Enviar {imageIds.length} arquivo(s) via WhatsApp</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {sent ? (
          <div style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ color: '#4ade80', fontWeight: 600 }}>
              {sent.sent}/{sent.total} enviado(s) com sucesso!
            </p>
            <button className="btn-novo" style={{ marginTop: '1rem' }} onClick={() => { onSent?.(); onClose() }}>Fechar</button>
          </div>
        ) : phoneNeeded ? (
          <div style={{ padding: '1rem' }}>
            <p style={{ color: '#f59e0b', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              {phoneNeededMessage || 'O cliente não possui número de WhatsApp cadastrado. Informe o número abaixo:'}
            </p>
            <div className="form-group">
              <label>Número WhatsApp (com DDI e DDD)</label>
              <input
                type="tel"
                value={manualPhone}
                onChange={e => setManualPhone(e.target.value)}
                placeholder="Ex: 5511999999999"
                autoFocus
              />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button className="btn-novo" onClick={() => handleSend(manualPhone)} disabled={sending || !manualPhone.trim()} style={{ background: '#25d366' }}>
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
              <button type="button" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '1rem' }}>
            <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {imageIds.length} arquivo(s) serão enviados para o WhatsApp cadastrado do cliente{' '}
              <strong style={{ color: '#e2e8f0' }}>{customerName}</strong>.
            </p>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button className="btn-novo" onClick={() => handleSend()} disabled={sending} style={{ background: '#25d366' }}>
                {sending ? 'Enviando...' : 'Confirmar Envio'}
              </button>
              <button type="button" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
