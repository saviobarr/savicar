import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, setToken, setProfile, setUserId } from '../api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ user_name: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await login(form.user_name, form.password)
      setToken(data.token)
      setProfile(data.profile)
      setUserId(data.id_user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #0f1117)',
    }}>
      <div style={{
        background: 'var(--surface, #1a1d27)',
        border: '1px solid var(--border, #2e3347)',
        borderRadius: 12,
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: 380,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src={`${import.meta.env.VITE_API_URL ?? ''}/tenant-config/logo`}
            alt="Logo"
            style={{ maxHeight: 60, marginBottom: '1rem' }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600 }}>Entrar no sistema</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Usuário</label>
            <input
              name="user_name"
              value={form.user_name}
              onChange={handleChange}
              autoFocus
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Senha</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p style={{ color: '#f87171', fontSize: '0.875rem', margin: 0 }}>{error}</p>
          )}
          <button
            type="submit"
            className="btn-novo"
            disabled={loading}
            style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
