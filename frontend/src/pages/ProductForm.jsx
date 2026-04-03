import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { MdSave, MdArrowBack } from 'react-icons/md'

const CATEGORIES = ['Electronics', 'Furniture', 'Clothing', 'Accessories', 'Food & Beverage', 'Raw Materials', 'Others']
const SUPPLIERS  = ['Dell Inc.', 'Ergonomix Co.', 'Anker Corp.', 'Logitech.', 'FlexiDesk.', 'Keychron.', 'LG Display.']
const UNITS      = ['pcs', 'kg', 'liters', 'meters', 'boxes', 'cartons', 'sets']

const EMPTY_FORM = {
  name: '', sku: '', category: '', supplier: '', unit: 'pcs',
  qty: '', reorder_point: '', price: '', cost: '',
  description: '', is_active: true,
}

export default function ProductForm() {
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
    if (!form.name)     e.name     = 'Product name is required'
    if (!form.sku)      e.sku      = 'SKU is required'
    if (!form.category) e.category = 'Category is required'
    if (!form.price)    e.price    = 'Price is required'
    if (!form.qty && form.qty !== 0) e.qty = 'Quantity is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    // TODO: call createProduct / updateProduct from api/inventory.js
    await new Promise(r => setTimeout(r, 800)) // simulate API
    setSaving(false)
    setSuccess(true)
    setTimeout(() => navigate('/products'), 1200)
  }

  const Field = ({ label, name, type = 'text', children, required }) => (
    <div className="form-group">
      <label>{label}{required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
      {children || (
        <input
          className="input"
          type={type}
          value={form[name]}
          onChange={e => set(name, e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          style={errors[name] ? { borderColor: 'var(--danger)' } : {}}
        />
      )}
      {errors[name] && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors[name]}</span>}
    </div>
  )

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
          <div className="page-subtitle">{isEdit ? 'Update product details' : 'Fill in the details to add a new product'}</div>
        </div>
        <Link to="/products" className="btn btn-outline"><MdArrowBack /> Back</Link>
      </div>

      {success && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, color: 'var(--success)', fontSize: 14 }}>
          ✅ Product {isEdit ? 'updated' : 'created'} successfully! Redirecting…
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
                  <Field label="Product Name" name="name" required />
                </div>
                <Field label="SKU / Barcode" name="sku" required />
                <div className="form-group">
                  <label>Category <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select className="select" value={form.category} onChange={e => set('category', e.target.value)}
                    style={errors.category ? { borderColor: 'var(--danger)' } : {}}>
                    <option value="">Select category…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.category && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.category}</span>}
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <select className="select" value={form.supplier} onChange={e => set('supplier', e.target.value)}>
                    <option value="">Select supplier…</option>
                    {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea className="input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Product description…" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Pricing</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <Field label="Selling Price ($)" name="price" type="number" required />
                <Field label="Cost Price ($)" name="cost" type="number" />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Stock</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Initial Quantity" name="qty" type="number" required />
                <div className="form-group">
                  <label>Unit of Measure</label>
                  <select className="select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <Field label="Reorder Point" name="reorder_point" type="number" />
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Status</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div
                  onClick={() => set('is_active', !form.is_active)}
                  style={{
                    width: 48, height: 26, borderRadius: 13,
                    background: form.is_active ? 'var(--accent)' : 'var(--border-light)',
                    position: 'relative', transition: '0.2s', flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: form.is_active ? 26 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: '0.2s',
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{form.is_active ? 'Active' : 'Inactive'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Product is {form.is_active ? 'visible' : 'hidden'} in inventory</div>
                </div>
              </label>
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving} style={{ justifyContent: 'center', padding: '14px' }}>
              {saving ? 'Saving…' : <><MdSave /> {isEdit ? 'Update Product' : 'Save Product'}</>}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
