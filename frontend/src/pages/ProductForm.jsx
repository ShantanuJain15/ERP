import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { MdSave, MdArrowBack } from 'react-icons/md'
import { createProduct, updateProduct, getProduct, getSuppliers } from '../api/inventory'

// ── Field must live OUTSIDE the parent component so React doesn't
// recreate it on every render (which would unmount/remount the input
// and lose focus after every keystroke).
function Field({ label, value, onChange, error, type = 'text', required, placeholder, step }) {
  return (
    <div className="form-group">
      <label>{label}{required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
      <input
        className="input"
        type={type}
        step={step}
        value={value}
        onChange={onChange}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        style={error ? { borderColor: 'var(--danger)' } : {}}
      />
      {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}

const PRODUCT_TYPES = [
  { value: 'GENERIC', label: 'Generic' },
  { value: 'AC',      label: 'Air Conditioner' },
]

const EMPTY_FORM = {
  name: '',
  sku: '',
  brand: '',
  type: 'GENERIC',
  supplier: '',
  description: '',
  price: '',
  quantity: '',
  reorder_level: '',
  is_active: true,
}

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm]         = useState(EMPTY_FORM)
  const [suppliers, setSuppliers] = useState([])
  const [errors, setErrors]     = useState({})
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(isEdit)
  const [success, setSuccess]   = useState(false)
  const [apiError, setApiError] = useState(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // ── Load suppliers dropdown ───────────────────────────────────────────────
  useEffect(() => {
    getSuppliers()
      .then(res => setSuppliers(Array.isArray(res.data) ? res.data : res.data.results ?? []))
      .catch(() => {}) // non-critical; dropdown just stays empty
  }, [])

  // ── Load product for edit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    getProduct(id)
      .then(res => {
        const p = res.data
        setForm({
          name:          p.name          ?? '',
          sku:           p.sku           ?? '',
          brand:         p.brand         ?? '',
          type:          p.type          ?? 'GENERIC',
          supplier:      p.supplier      ?? '',
          description:   p.description   ?? '',
          price:         p.price         ?? '',
          quantity:      p.quantity      ?? '',
          reorder_level: p.reorder_level ?? '',
          is_active:     p.is_active     ?? true,
        })
      })
      .catch(() => setApiError('Failed to load product details.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name  = 'Product name is required'
    if (!form.price)       e.price = 'Price is required'
    else if (isNaN(Number(form.price)) || Number(form.price) < 0)
      e.price = 'Enter a valid price'
    if (form.quantity !== '' && isNaN(Number(form.quantity)))
      e.quantity = 'Quantity must be a number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setApiError(null)

    const payload = {
      name:          form.name.trim(),
      sku:           form.sku.trim()   || undefined,
      brand:         form.brand.trim() || undefined,
      type:          form.type         || undefined,
      supplier:      form.supplier     || null,
      description:   form.description.trim() || '',
      price:         Number(form.price),
      quantity:      form.quantity !== '' ? Number(form.quantity) : 0,
      reorder_level: form.reorder_level !== '' ? Number(form.reorder_level) : 0,
      is_active:     form.is_active,
    }

    try {
      if (isEdit) {
        await updateProduct(id, payload)
      } else {
        await createProduct(payload)
      }
      setSuccess(true)
      setTimeout(() => navigate('/products'), 1200)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        // Map DRF field errors back to form errors
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

  // ── Field helper (defined outside — see top of file) ────────────────────
  // Helper to bind a field by name to form state
  const field = (name, overrides = {}) => ({
    value:    form[name],
    onChange: e => set(name, e.target.value),
    error:    errors[name],
    ...overrides,
  })

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <div className="breadcrumb">
          <Link to="/products">Products</Link>
          <span>›</span>
          <span>Edit Product</span>
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
            <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
          </div>
        </div>
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="breadcrumb">
        <Link to="/products">Products</Link>
        <span>›</span>
        <span>{isEdit ? 'Edit Product' : 'New Product'}</span>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? 'Edit Product' : 'Add New Product'}</div>
          <div className="page-subtitle">
            {isEdit ? 'Update product details' : 'Fill in the details to add a new product'}
          </div>
        </div>
        <Link to="/products" className="btn btn-outline"><MdArrowBack /> Back</Link>
      </div>

      {/* Success banner */}
      {success && (
        <div style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
          color: 'var(--success)', fontSize: 14,
        }}>
          ✅ Product {isEdit ? 'updated' : 'created'} successfully! Redirecting…
        </div>
      )}

      {/* API error banner */}
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

            {/* Basic info */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Basic Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

                <div style={{ gridColumn: '1/-1' }}>
                  <Field label="Product Name" required {...field('name')} />
                </div>

                <Field label="SKU / Barcode" placeholder="Auto-generated if blank" {...field('sku')} />
                <Field label="Brand" placeholder="e.g. Samsung" {...field('brand')} />

                {/* Type */}
                <div className="form-group">
                  <label>Product Type</label>
                  <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
                    {PRODUCT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Supplier */}
                <div className="form-group">
                  <label>Supplier</label>
                  <select
                    className="select"
                    value={form.supplier}
                    onChange={e => set('supplier', e.target.value)}
                  >
                    <option value="">— No supplier —</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={form.description}
                      onChange={e => set('description', e.target.value)}
                      placeholder="Product description…"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Pricing</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
                <Field label="Selling Price ($)" type="number" step="0.01" required {...field('price')} />
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Stock */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Stock</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Quantity" type="number" placeholder="0" {...field('quantity')} />
                <Field label="Reorder Level" type="number" placeholder="0" {...field('reorder_level')} />
              </div>
            </div>

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
                    position: 'absolute', top: 3, left: form.is_active ? 26 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: '0.2s',
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {form.is_active ? 'Active' : 'Inactive'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Product is {form.is_active ? 'visible' : 'hidden'} in inventory
                  </div>
                </div>
              </label>
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving || success}
              style={{ justifyContent: 'center', padding: '14px' }}
            >
              {saving
                ? 'Saving…'
                : <><MdSave /> {isEdit ? 'Update Product' : 'Save Product'}</>
              }
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
