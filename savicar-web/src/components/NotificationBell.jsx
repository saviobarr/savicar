import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  fetchAllNotifications,
  fetchUnreadNotificationCount,
  fetchServiceOrderById,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api'

const POLL_INTERVAL_MS = 20000
const TOAST_DURATION_MS = 6000

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState([])
  const btnRef = useRef(null)
  const dropdownRef = useRef(null)
  const pollRef = useRef(null)
  const previousCountRef = useRef(null)
  const knownIdsRef = useRef(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    init()
    pollRef.current = setInterval(loadCount, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (btnRef.current?.contains(e.target)) return
      if (dropdownRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Seeds the known-ids set quietly so the first poll can tell a truly new
  // notification apart from ones that were already unread before mount.
  async function init() {
    try {
      const all = await fetchAllNotifications() ?? []
      all.forEach(n => knownIdsRef.current.add(n.id_notification))
      setItems(all)
      const unread = all.filter(n => !n.is_read).length
      previousCountRef.current = unread
      setCount(unread)
    } catch {
      try {
        const data = await fetchUnreadNotificationCount()
        previousCountRef.current = data.count ?? 0
        setCount(data.count ?? 0)
      } catch {
        // give up silently — the next poll retries
      }
    }
  }

  async function loadCount() {
    try {
      const data = await fetchUnreadNotificationCount()
      const newCount = data.count ?? 0
      if (previousCountRef.current !== null && newCount > previousCountRef.current) {
        await checkForNewNotifications()
      }
      previousCountRef.current = newCount
      setCount(newCount)
    } catch {
      // transient network error — try again on next poll
    }
  }

  async function checkForNewNotifications() {
    try {
      const all = await fetchAllNotifications() ?? []
      const newOnes = all.filter(n => !n.is_read && !knownIdsRef.current.has(n.id_notification))
      newOnes.forEach(n => knownIdsRef.current.add(n.id_notification))
      setItems(all)
      if (newOnes.length > 0) {
        setToasts(prev => [...prev, ...newOnes])
        newOnes.forEach(n => setTimeout(() => dismissToast(n.id_notification), TOAST_DURATION_MS))
      }
    } catch {
      // ignore — the badge count already updated, only the toast is missed
    }
  }

  function dismissToast(id) {
    setToasts(prev => prev.filter(t => t.id_notification !== id))
  }

  async function loadList() {
    setLoading(true)
    try {
      setItems(await fetchAllNotifications() ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  function toggleOpen() {
    const next = !open
    if (next && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 8, left: rect.left })
      loadList()
    }
    setOpen(next)
  }

  async function openNotification(n) {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id_notification)
        setItems(prev => prev.map(i => i.id_notification === n.id_notification ? { ...i, is_read: true } : i))
        setCount(c => Math.max(0, c - 1))
        previousCountRef.current = Math.max(0, (previousCountRef.current ?? 1) - 1)
      } catch {
        // keep showing as unread if the request failed
      }
    }
    if (n.id_order) {
      try {
        const item = await fetchServiceOrderById(n.id_order)
        navigate('/service-orders/edit', { state: { item } })
      } catch {
        navigate('/service-orders')
      }
    }
  }

  async function handleItemClick(n) {
    setOpen(false)
    await openNotification(n)
  }

  async function handleToastClick(n) {
    dismissToast(n.id_notification)
    await openNotification(n)
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setItems(prev => prev.map(i => ({ ...i, is_read: true })))
      setCount(0)
      previousCountRef.current = 0
    } catch {
      // ignore — user can retry
    }
  }

  return (
    <div className="notification-bell">
      <button ref={btnRef} className="notification-bell-btn" onClick={toggleOpen} title="Notificações">
        🔔
        {count > 0 && <span className="notification-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && position && createPortal(
        <div className="notification-dropdown" ref={dropdownRef} style={{ top: position.top, left: position.left }}>
          <div className="notification-dropdown-header">
            <span>Notificações</span>
            {items.some(i => !i.is_read) && (
              <button className="notification-mark-all" onClick={handleMarkAllRead}>Marcar todas como lidas</button>
            )}
          </div>
          <div className="notification-dropdown-list">
            {loading && <div className="notification-empty">Carregando…</div>}
            {!loading && items.length === 0 && <div className="notification-empty">Sem notificações</div>}
            {!loading && items.map(n => (
              <button
                key={n.id_notification}
                className={`notification-item${n.is_read ? '' : ' unread'}`}
                onClick={() => handleItemClick(n)}
              >
                <span className="notification-message">{n.message}</span>
                <span className="notification-date">{formatDate(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
      {toasts.length > 0 && createPortal(
        <div className="notification-toast-container">
          {toasts.map(n => (
            <div key={n.id_notification} className="notification-toast" onClick={() => handleToastClick(n)}>
              <span className="notification-toast-icon">🔔</span>
              <div className="notification-toast-body">
                <span className="notification-toast-title">Nova notificação</span>
                <span className="notification-toast-message">{n.message}</span>
              </div>
              <button
                className="notification-toast-close"
                onClick={e => { e.stopPropagation(); dismissToast(n.id_notification) }}
                title="Fechar"
              >
                ×
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
