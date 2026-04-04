import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { MdSave, MdArrowBack } from 'react-icons/md'

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  company: '',
  address: '',
  city: '',
  country: '',
  notes: '',
  status: 'active',
}

export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name)  e.name  = 'Customer name is required'
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address'
    if (!form.phone) e.phone = 'Phone number is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    // TODO: call createCustomer / updateCustomer from API
    await new Promise(r => setTimeout(r, 800)) // simulate API
    setSaving(false)
    setSuccess(true)
    setTimeout(() => navigate('/customers'), 1200)
  }

  const Field = ({ label, name, type = 'text', required, placeholder }) => (
    <div className="form-group">
      <label>{label}{required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
      <input
        className="input"
        type={type}
        value={form[name]}
        onChange={e => set(name, e.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        style={errors[name] ? { borderColor: 'var(--danger)' } : {}}
      />
      {errors[name] && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors[name]}</span>}
    </div>
  )

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
            {isEdit ? 'Update customer details' : 'Fill in the details to add a new customer'}
          </div>
        </div>
        <Link to="/customers" className="btn btn-outline"><MdArrowBack /> Back</Link>
      </div>

      {success && (
        <div style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
          color: 'var(--success)', fontSize: 14
        }}>
          ✅ Customer {isEdit ? 'updated' : 'created'} successfully! Redirecting…
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Basic Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <Field label="Full Name / Company Name" name="name" required />
                </div>
                <Field label="Email Address" name="email" type="email" required />
                <Field label="Phone Number" name="phone" type="tel" required placeholder="+1 555-0000" />
                <div style={{ gridColumn: '1/-1' }}>
                  <Field label="Company" name="company" placeholder="Optional company name" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Address</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <Field label="Street Address" name="address" placeholder="123 Main St" />
                </div>
                <Field label="City" name="city" placeholder="New York" />
                <Field label="Country" name="country" placeholder="United States" />
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Notes</div>
              <div className="form-group">
                <label>Internal Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Any additional notes about this customer…"
                />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Status</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div
                  onClick={() => set('status', form.status === 'active' ? 'inactive' : 'active')}
                  style={{
                    width: 48, height: 26, borderRadius: 13,
                    background: form.status === 'active' ? 'var(--accent)' : 'var(--border-light)',
                    position: 'relative', transition: '0.2s', flexShrink: 0, cursor: 'pointer',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3,
                    left: form.status === 'active' ? 26 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: '0.2s',
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {form.status === 'active' ? 'Active' : 'Inactive'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Customer is {form.status === 'active' ? 'visible' : 'hidden'}
                  </div>
                </div>
              </label>
            </div>

            <div className="card" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--accent-light)' }}>💡 Tip</strong><br />
                Required fields are marked with a <span style={{ color: 'var(--danger)' }}>*</span>.
                Use internal notes to store payment preferences or special instructions.
              </div>
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving}
              style={{ justifyContent: 'center', padding: '14px' }}
            >
              {saving ? 'Saving…' : <><MdSave /> {isEdit ? 'Update Customer' : 'Save Customer'}</>}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
