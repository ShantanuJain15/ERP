import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { MdSave, MdArrowBack, MdAdd, MdDelete, MdDrafts } from 'react-icons/md'
import {
  createInvoice, updateInvoice, getInvoice,
  getCustomers, getProducts, getNextInvoiceNumber,
  createCustomer
} from '../api/inventory'

// ── Reusable Field (stable identity) ──────────────────────────────────────────
function Field({ label, value, onChange, error, type = 'text', required, placeholder, step, disabled }) {
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
        disabled={disabled}
      />
      {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCurrency = (n) =>
  Number(n || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

const EMPTY_ITEM = { product: '', quantity: '1', price: '', description: '' }

const EMPTY_FORM = {
  invoice_number: '',
  customer: '',
  paid_amount: '0',
  items: [{ ...EMPTY_ITEM }],
}

export default function InvoiceForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm]           = useState(EMPTY_FORM)
  const [customers, setCustomers] = useState([])
  const [products, setProducts]   = useState([])
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [loading, setLoading]     = useState(isEdit)
  const [success, setSuccess]     = useState(false)
  const [apiError, setApiError]   = useState(null)
  const [suggestedNumber, setSuggestedNumber] = useState('')
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomer, setNewCustomer]         = useState({ name: '', phone: '', email: '' })
  const [addingCustomer, setAddingCustomer]   = useState(false)
  const [custError, setCustError]             = useState(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // ── Load dropdowns & next invoice number ────────────────────────────────────
  useEffect(() => {
    getCustomers()
      .then(res => setCustomers(Array.isArray(res.data) ? res.data : res.data.results ?? []))
      .catch(() => {})
    getProducts()
      .then(res => setProducts(Array.isArray(res.data) ? res.data : res.data.results ?? []))
      .catch(() => {})

    // Pre-fill next invoice number for new invoices
    if (!isEdit) {
      getNextInvoiceNumber()
        .then(res => {
          const next = res.data?.next_invoice_number
          if (next) {
            set('invoice_number', next)
            setSuggestedNumber(next)
          }
        })
        .catch(() => {})
    }
  }, [isEdit])

  // ── Load invoice for edit ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    getInvoice(id)
      .then(res => {
        const inv = res.data
        setForm({
          invoice_number: inv.invoice_number ?? '',
          customer:       inv.customer       ?? '',
          paid_amount:    inv.paid_amount    ?? '0',
          items: (inv.items && inv.items.length > 0)
            ? inv.items.map(it => ({
                product:     it.product  ?? '',
                quantity:    String(it.quantity ?? 1),
                price:       String(it.price ?? ''),
                description: it.description ?? '',
              }))
            : [{ ...EMPTY_ITEM }],
        })
      })
      .catch(() => setApiError('Failed to load invoice details.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  // ── Line items helpers ──────────────────────────────────────────────────────
  const setItem = (idx, key, val) => {
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [key]: val }

      // Auto-fill price when product is selected
      if (key === 'product' && val) {
        const prod = products.find(p => String(p.id) === String(val))
        if (prod) {
          items[idx].price = String(prod.price)
        }
      }

      return { ...prev, items }
    })
  }

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }))
  }

  const removeItem = (idx) => {
    setForm(prev => {
      const items = prev.items.filter((_, i) => i !== idx)
      return { ...prev, items: items.length > 0 ? items : [{ ...EMPTY_ITEM }] }
    })
  }

  // ── Computed totals ─────────────────────────────────────────────────────────
  const lineTotal = (item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.price) || 0
    return qty * price
  }

  const grandTotal = form.items.reduce((sum, it) => sum + lineTotal(it), 0)
  const balance = grandTotal - (Number(form.paid_amount) || 0)

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (isDraft = false) => {
    const e = {}
    if (!form.invoice_number.trim()) {
      e.invoice_number = 'Invoice number is required'
    } else if (!/^PFE00\d{3}$/.test(form.invoice_number.trim())) {
      e.invoice_number = 'Must follow format PFE00XXX (e.g. PFE00001)'
    }

    if (!isDraft) {
      if (!form.customer) e.customer = 'Please select a customer'

      // Validate at least one valid item
      const validItems = form.items.filter(it => it.product && Number(it.quantity) > 0 && Number(it.price) > 0)
      if (validItems.length === 0) e.items = 'At least one line item with product, quantity, and price is required'

      // Per-item validation
      form.items.forEach((it, i) => {
        if (it.product) {
          if (!it.quantity || Number(it.quantity) <= 0) e[`item_${i}_quantity`] = 'Invalid'
          if (!it.price || Number(it.price) < 0) e[`item_${i}_price`] = 'Invalid'
        }
      })

      if (form.paid_amount && Number(form.paid_amount) < 0) e.paid_amount = 'Cannot be negative'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    setApiError(null)

    const validItems = form.items
      .filter(it => it.product && Number(it.quantity) > 0)
      .map(it => ({
        product:     Number(it.product),
        quantity:    Number(it.quantity),
        price:       Number(it.price),
        description: it.description?.trim() || '',
      }))

    const payload = {
      invoice_number: form.invoice_number.trim(),
      customer:       Number(form.customer),
      paid_amount:    Number(form.paid_amount) || 0,
      status:         'PENDING',
      items:          validItems,
    }

    try {
      if (isEdit) {
        await updateInvoice(id, payload)
      } else {
        await createInvoice(payload)
      }
      setSuccess(true)
      setTimeout(() => navigate('/invoices'), 1200)
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

  // ── Save as Draft ────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!validate(true)) return
    setSavingDraft(true)
    setApiError(null)

    const validItems = form.items
      .filter(it => it.product && Number(it.quantity) > 0)
      .map(it => ({
        product:     Number(it.product),
        quantity:    Number(it.quantity),
        price:       Number(it.price) || 0,
        description: it.description?.trim() || '',
      }))

    const payload = {
      invoice_number: form.invoice_number.trim(),
      status:         'DRAFT',
      paid_amount:    Number(form.paid_amount) || 0,
      items:          validItems,
    }
    if (form.customer) payload.customer = Number(form.customer)

    try {
      if (isEdit) {
        await updateInvoice(id, payload)
      } else {
        await createInvoice(payload)
      }
      setSuccess(true)
      setTimeout(() => navigate('/invoices'), 1200)
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
        setApiError(err.response?.data?.detail || 'Something went wrong.')
      }
    } finally {
      setSavingDraft(false)
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <div className="breadcrumb">
          <Link to="/invoices">Invoices</Link>
          <span>›</span>
          <span>Edit Invoice</span>
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="breadcrumb">
        <Link to="/invoices">Invoices</Link>
        <span>›</span>
        <span>{isEdit ? 'Edit Invoice' : 'New Invoice'}</span>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? 'Edit Invoice' : 'Create New Invoice'}</div>
          <div className="page-subtitle">
            {isEdit ? 'Update invoice details and line items' : 'Fill in the details to generate a new invoice'}
          </div>
        </div>
        <Link to="/invoices" className="btn btn-outline"><MdArrowBack /> Back</Link>
      </div>

      {/* Success banner */}
      {success && (
        <div style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
          color: 'var(--success)', fontSize: 14,
        }}>
          ✅ Invoice {isEdit ? 'updated' : 'created'} successfully! Redirecting…
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

            {/* Invoice header card */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Invoice Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

                <div className="form-group">
                  <label>Invoice Number <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    className="input"
                    value={form.invoice_number}
                    onChange={e => set('invoice_number', e.target.value.toUpperCase())}
                    placeholder="e.g. PFE00001"
                    maxLength={8}
                    style={errors.invoice_number ? { borderColor: 'var(--danger)' } : {}}
                    disabled={isEdit}
                  />
                  {errors.invoice_number ? (
                    <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.invoice_number}</span>
                  ) : !isEdit && suggestedNumber && form.invoice_number.trim() && form.invoice_number.trim() !== suggestedNumber ? (() => {
                    const entered = parseInt(form.invoice_number.trim().slice(5), 10)
                    const expected = parseInt(suggestedNumber.slice(5), 10)
                    const gap = entered - expected
                    return (
                      <span style={{
                        fontSize: 12, color: '#f59e0b', marginTop: 2, display: 'flex',
                        flexDirection: 'column', gap: 2,
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          ⚠️ Next in sequence is <strong>{suggestedNumber}</strong>.
                          <button
                            type="button"
                            onClick={() => set('invoice_number', suggestedNumber)}
                            style={{
                              background: 'none', border: 'none', color: '#f59e0b',
                              textDecoration: 'underline', cursor: 'pointer', fontSize: 12,
                              padding: 0,
                            }}
                          >
                            Use it
                          </button>
                        </span>
                        {gap > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--danger)' }}>
                            ⛔ Skipping {gap} invoice number{gap> 0 ? 's' : ''} in the sequence
                          </span>
                        )}
                      </span>
                    )
                  })() : (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                      Format: PFE00XXX (auto-assigned)
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Customer <span style={{ color: 'var(--danger)' }}>*</span></span>
                    {!showAddCustomer && (
                      <button
                        type="button"
                        onClick={() => { setShowAddCustomer(true); setCustError(null) }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--accent-light)',
                          cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 2, padding: 0,
                        }}
                      >
                        <MdAdd size={14} /> New
                      </button>
                    )}
                  </label>

                  {!showAddCustomer ? (
                    <>
                      <select
                        className="select"
                        value={form.customer}
                        onChange={e => set('customer', e.target.value)}
                        style={errors.customer ? { borderColor: 'var(--danger)' } : {}}
                      >
                        <option value="">— Select customer —</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                        ))}
                      </select>
                      {errors.customer && (
                        <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.customer}</span>
                      )}
                    </>
                  ) : (
                    <div style={{
                      border: '1px solid var(--border)', borderRadius: 10,
                      padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
                      background: 'var(--card-bg)', animation: 'slideUp 0.15s ease',
                    }}>
                      <input
                        className="input" placeholder="Customer name *"
                        value={newCustomer.name}
                        onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))}
                        autoFocus
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input
                          className="input" placeholder="Phone" type="tel"
                          value={newCustomer.phone}
                          onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
                        />
                        <input
                          className="input" placeholder="Email" type="email"
                          value={newCustomer.email}
                          onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))}
                        />
                      </div>
                      {custError && (
                        <span style={{ fontSize: 12, color: 'var(--danger)' }}>{custError}</span>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                        <Link
                          to="/customers/new"
                          target="_blank"
                          style={{
                            fontSize: 12, color: 'var(--accent-light)',
                            textDecoration: 'none', display: 'flex',
                            alignItems: 'center', gap: 3,
                          }}
                        >
                          Full form →
                        </Link>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setShowAddCustomer(false)
                              setNewCustomer({ name: '', phone: '', email: '' })
                              setCustError(null)
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={addingCustomer || !newCustomer.name.trim()}
                            onClick={async () => {
                              setAddingCustomer(true)
                              setCustError(null)
                              try {
                                const payload = { name: newCustomer.name.trim() }
                                if (newCustomer.phone.trim()) payload.phone = newCustomer.phone.trim()
                                if (newCustomer.email.trim()) payload.email = newCustomer.email.trim()
                                const res = await createCustomer(payload)
                                const created = res.data
                                setCustomers(prev => [...prev, created])
                                set('customer', String(created.id))
                                setShowAddCustomer(false)
                                setNewCustomer({ name: '', phone: '', email: '' })
                              } catch (err) {
                                const d = err.response?.data
                                if (d && typeof d === 'object') {
                                  const msg = Object.values(d).flat().join(', ')
                                  setCustError(msg)
                                } else {
                                  setCustError('Failed to create customer')
                                }
                              } finally {
                                setAddingCustomer(false)
                              }
                            }}
                          >
                            {addingCustomer ? 'Saving…' : <><MdAdd size={14} /> Add</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Line items card */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 0 }}>Line Items</div>
                  <div className="card-sub">Add products to this invoice</div>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={addItem}>
                  <MdAdd /> Add Item
                </button>
              </div>

              {errors.items && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                  color: 'var(--danger)', fontSize: 13,
                }}>
                  {errors.items}
                </div>
              )}

              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 40px',
                gap: 12,
                padding: '0 0 10px',
                borderBottom: '1px solid var(--border)',
                marginBottom: 12,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Product</div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Qty</div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Unit Price</div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', textAlign: 'right' }}>Total</div>
                <div></div>
              </div>

              {/* Item rows */}
              {form.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 40px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: idx < form.items.length - 1 ? '1px solid var(--border)' : 'none',
                    animation: 'slideUp 0.15s ease',
                  }}
                >
                  {/* Product select */}
                  <select
                    className="select"
                    value={item.product}
                    onChange={e => setItem(idx, 'product', e.target.value)}
                    style={{
                      fontSize: 13,
                      ...(errors[`item_${idx}_product`] ? { borderColor: 'var(--danger)' } : {}),
                    }}
                  >
                    <option value="">— Select —</option>
                    {products
                      .filter(p => p.is_active && p.quantity > 0)
                      .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(${p.sku})` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Quantity */}
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => setItem(idx, 'quantity', e.target.value)}
                    style={{
                      fontSize: 13,
                      ...(errors[`item_${idx}_quantity`] ? { borderColor: 'var(--danger)' } : {}),
                    }}
                  />

                  {/* Price */}
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.price}
                    onChange={e => setItem(idx, 'price', e.target.value)}
                    placeholder="0.00"
                    style={{
                      fontSize: 13,
                      ...(errors[`item_${idx}_price`] ? { borderColor: 'var(--danger)' } : {}),
                    }}
                  />

                  {/* Line total */}
                  <div style={{
                    textAlign: 'right', fontWeight: 600, fontSize: 13,
                    color: lineTotal(item) > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}>
                    {fmtCurrency(lineTotal(item))}
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--danger)',
                      cursor: 'pointer', fontSize: 18, padding: 4,
                      opacity: form.items.length === 1 ? 0.3 : 1,
                    }}
                    disabled={form.items.length === 1}
                    title="Remove item"
                  >
                    <MdDelete />
                  </button>

                  {/* Description — spans full row */}
                  <div style={{ gridColumn: '1 / -1', paddingBottom: 4 }}>
                    <input
                      className="input"
                      value={item.description || ''}
                      onChange={e => setItem(idx, 'description', e.target.value)}
                      placeholder="Item description / notes (optional)"
                      style={{ fontSize: 12, padding: '6px 10px' }}
                    />
                  </div>
                </div>
              ))}

              {/* Add another item row */}
              <button
                type="button"
                onClick={addItem}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: '1px dashed var(--border-light)',
                  borderRadius: 8, padding: '10px 16px', marginTop: 12,
                  color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
                  width: '100%', justifyContent: 'center',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent-light)' }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border-light)'; e.target.style.color = 'var(--text-muted)' }}
              >
                <MdAdd /> Add another item
              </button>
            </div>
          </div>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Summary card */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Summary</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Line items count */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span>Items</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {form.items.filter(it => it.product).length}
                  </span>
                </div>

                <hr className="divider" style={{ margin: '4px 0' }} />

                {/* Subtotal per item */}
                {form.items.filter(it => it.product).map((item, idx) => {
                  const prod = products.find(p => String(p.id) === String(item.product))
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prod?.name ?? `Product #${item.product}`} × {item.quantity}
                      </span>
                      <span>{fmtCurrency(lineTotal(item))}</span>
                    </div>
                  )
                })}

                <hr className="divider" style={{ margin: '4px 0' }} />

                {/* Grand Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                  <span style={{ fontWeight: 600 }}>Total</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-light)', fontSize: 18 }}>
                    {fmtCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment card */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Payment</div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Paid Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.paid_amount}
                  onChange={e => set('paid_amount', e.target.value)}
                  placeholder="0.00"
                  style={errors.paid_amount ? { borderColor: 'var(--danger)' } : {}}
                />
                {errors.paid_amount && (
                  <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.paid_amount}</span>
                )}
              </div>

              {/* Balance due */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderRadius: 8,
                background: balance > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${balance > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Balance Due</span>
                <span style={{
                  fontWeight: 700, fontSize: 15,
                  color: balance > 0 ? 'var(--danger)' : 'var(--success)',
                }}>
                  {fmtCurrency(Math.max(balance, 0))}
                </span>
              </div>

              {/* Status indicator */}
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                {grandTotal > 0 && Number(form.paid_amount) >= grandTotal ? (
                  <span className="badge badge-success" style={{ fontSize: 12, padding: '4px 14px' }}>Fully Paid</span>
                ) : Number(form.paid_amount) > 0 ? (
                  <span className="badge badge-warning" style={{ fontSize: 12, padding: '4px 14px' }}>Partially Paid</span>
                ) : (
                  <span className="badge badge-neutral" style={{ fontSize: 12, padding: '4px 14px' }}>Pending</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving || savingDraft || success}
                style={{ justifyContent: 'center', padding: '14px' }}
              >
                {saving
                  ? 'Saving…'
                  : <><MdSave /> {isEdit ? 'Update Invoice' : 'Create Invoice'}</>
                }
              </button>
              {!isEdit && (
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={saving || savingDraft || success}
                  onClick={handleSaveDraft}
                  style={{
                    justifyContent: 'center', padding: '12px',
                    borderStyle: 'dashed',
                  }}
                >
                  {savingDraft
                    ? 'Saving draft…'
                    : <><MdDrafts /> Save as Draft</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </>
  )
}
