import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdLock, MdPerson, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import api from '../api/axiosInstance'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Mock user authentication without backend
      if (form.username === 'admin' && form.password === 'admin123') {
        localStorage.setItem('access_token', 'mock-access-token-12345')
        localStorage.setItem('refresh_token', 'mock-refresh-token-12345')
        navigate('/dashboard')
      } else {
        throw new Error('Invalid credentials')
      }  
    } catch {
      setError('Invalid username or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Background orbs */}
      <div className="login-bg-orb" style={{ width: 500, height: 500, background: '#6366f1', top: -200, left: -150 }} />
      <div className="login-bg-orb" style={{ width: 400, height: 400, background: '#38bdf8', bottom: -150, right: -100 }} />

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon" style={{ width: 44, height: 44, fontSize: 22 }}>📦</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>ERP Suite</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Inventory Management</div>
          </div>
        </div>

        <div className="login-title">Welcome back</div>
        <div className="login-sub">Sign in to access your ERP dashboard</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="form-group">
            <label>Username</label>
            <div style={{ position: 'relative' }}>
              <MdPerson style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
              <input
                className="input"
                style={{ paddingLeft: 42 }}
                name="username"
                placeholder="Enter your username"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <MdLock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
              <input
                className="input"
                style={{ paddingLeft: 42, paddingRight: 42 }}
                name="password"
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: 0 }}
              >
                {showPw ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: 'center', padding: '12px', marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          ERP Suite v1.0 — Secure Access
        </p>
      </div>
    </div>
  )
}
