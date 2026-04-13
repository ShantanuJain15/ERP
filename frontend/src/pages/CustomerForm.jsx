import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { MdSave, MdArrowBack } from 'react-icons/md'
import { createCustomer, updateCustomer, getCustomer } from '../api/inventory'

// ── Field defined OUTSIDE to keep identity stable across renders ───────────────
function Field({ label, value, onChange, error, type = 'text', required, placeholder }) {
  return (
    <div className="form-group">
      <label>{label}{required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        style={error ? { borderColor: 'var(--danger)' } : {}}
      />
      {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}

const EMPTY_FORM = {
  name: '', email: '', phone: '', address: '', is_active: true,
}

export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm]         = useState(EMPTY_FORM)
  const [errors, setErrors]     = useState({})
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(isEdit)
  const [success, setSuccess]   = useState(false)
  const [apiError, setApiError] = useState(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // helper to bind a field name to form state
  const field = (name, overrides = {}) => ({
    value:    form[name],
    onChange: e => set(name, e.target.value),
    error:    errors[name],
    ...overrides,
  })

  // ── Load for edit ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    getCustomer(id)
      .then(res => {
        const c = res.data
        setForm({
          name:      c.name      ?? '',
          email:     c.email     ?? '',
          phone:     c.phone     ?? '',
          address:   c.address   ?? '',
          is_active: c.is_active ?? true,
        })
      })
      .catch(() => setApiError('Failed to load customer details.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name  = 'Customer name is required'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    if (form.email && !/\S+@\S+\.\S+/.test(form.email))
      e.email = 'Enter a valid email address'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setApiError(null)

    const payload = {
      name:      form.name.trim(),
      email:     form.email.trim() || '',
      phone:     form.phone.trim(),
      address:   form.address.trim() || '',
      is_active: form.is_active,
    }

    try {
      if (isEdit) {
        await updateCustomer(id, payload)
      } else {
        await createCustomer(payload)
      }
      setSuccess(true)
      setTimeout(() => navigate('/customers'), 1200)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const fieldErrors = {}
        Object.entries(data).forEach(([key, val]) => {
          fieldErrors[key] = Array.isArray(val) ? val[0] : val
        })
        setErrors(fieldErrors)
        setApiError('Please fix the errors below.')
      } else {
        setApiError(err.response?.data?.detail || 'Something went wrong. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <div className="breadcrumb">
          <Link to="/customers">Customers</Link>
          <span>›</span>
          <span>Edit Customer</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginTop: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[1, 2].map(i => (
              <div key={i} className="card">
                {[1, 2, 3].map(j => (
                  <div key={j} className="skeleton" style={{ height: 40, borderRadius: 8, marginBottom: 16 }} />
                ))}
              </div>
            ))}
          </div>
          <div className="card">
            <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
          </div>
        </div>
      </>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="breadcrumb">
        <Link to="/customers">Customers</Link>
        <span>›</span>
        <span>{isEdit ? 'Edit Customer' : 'New Customer'}</span>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? 'Edit Customer' : 'Add New Customer'}</div>
          <div className="page-subtitle">
            {isEdit ? 'Update customer details' : 'Fill in the details to register a new customer'}
          </div>
        </div>
        <Link to="/customers" className="btn btn-outline"><MdArrowBack /> Back</Link>
      </div>

      {success && (
        <div style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
          color: 'var(--success)', fontSize: 14,
        }}>
          ✅ Customer {isEdit ? 'updated' : 'created'} successfully! Redirecting…
        </div>
      )}

      {apiError && !success && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
          color: 'var(--danger)', fontSize: 14,
        }}>
          ⚠️ {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Contact Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

                <div style={{ gridColumn: '1/-1' }}>
                  <Field label="Full Name" required {...field('name')} />
                </div>

                <Field label="Email Address" type="email" placeholder="customer@example.com" {...field('email')} />
                <Field label="Phone Number" type="tel" required placeholder="+91 98765 43210" {...field('phone')} />

                <div style={{ gridColumn: '1/-1' }}>
                  <div className="form-group">
                    <label>Address</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={form.address}
                      onChange={e => set('address', e.target.value)}
                      placeholder="Street, City, State, PIN…"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Status toggle */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Status</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div
                  onClick={() => set('is_active', !form.is_active)}
                  style={{
                    width: 48, height: 26, borderRadius: 13,
                    background: form.is_active ? 'var(--accent)' : 'var(--border-light)',
                    position: 'relative', transition: '0.2s', flexShrink: 0, cursor: 'pointer',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3,
                    left: form.is_active ? 26 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: '0.2s',
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {form.is_active ? 'Active' : 'Inactive'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Customer is {form.is_active ? 'visible' : 'disabled'}
                  </div>
                </div>
              </label>
            </div>

            {/* Tip card */}
            <div className="card" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--accent-light)' }}>💡 Tip</strong><br />
                Fields marked <span style={{ color: 'var(--danger)' }}>*</span> are required.
                Email is optional but recommended for invoice delivery.
              </div>
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving || success}
              style={{ justifyContent: 'center', padding: '14px' }}
            >
              {saving
                ? 'Saving…'
                : <><MdSave /> {isEdit ? 'Update Customer' : 'Save Customer'}</>
              }
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
