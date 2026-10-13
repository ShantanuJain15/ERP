import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { MdAdd, MdClose, MdArrowBack } from 'react-icons/md'
import {
  getSuppliers, getWarehouses, getProducts,
  getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, getNextPoNumber,
} from '../api/inventory'
import { fmtAmount, rowsOf, unwrapErrors } from '../utils/purchase'

// Defined OUTSIDE the page component to keep its identity stable across
// renders — otherwise React remounts every input on each keystroke and the
// field loses focus. Same reasoning as CustomerForm/InvoiceForm.
const Field = ({ label, error, children, hint }) => (
  <div className="form-group">
    <label>{label}</label>
    {children}
    {hint && !error && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
  </div>
)

const EMPTY_FORM = {
  po_number: '',
  supplier: '',
  warehouse: '',
  expected_date: '',
  notes: '',
}

const EMPTY_ITEM = { product: '', quantity_ordered: 1, unit_price: '' }

export default function PurchaseOrderForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm]     = useState(EMPTY_FORM)
  const [items, setItems]   = useState([{ ...EMPTY_ITEM }])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [suppliers, setSuppliers]   = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [products, setProducts]     = useState([])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const field = (name) => ({
    value: form[name] ?? '',
    onChange: e => set(name, e.target.value),
  })

  // ── load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getSuppliers(), getWarehouses(), getProducts()])
      .then(([s, w, p]) => {
        setSuppliers(rowsOf(s))
        const whs = rowsOf(w)
        setWarehouses(whs)
        setProducts(rowsOf(p))

        if (!isEdit) {
          const def = whs.find(x => x.is_default)
          if (def) setForm(f => ({ ...f, warehouse: f.warehouse || String(def.id) }))
        }
      })
      .catch(() => setErrors(e => ({ ...e, _: 'Could not load suppliers, warehouses or products.' })))
  }, [isEdit])

  // ── load the document, or reserve a number for a new one ──────────────────
  const loadOrder = useCallback(async () => {
    if (!isEdit) {
      try {
        const res = await getNextPoNumber()
        setForm(f => ({ ...f, po_number: res.data.next_number }))
      } catch {
        /* numbering is a convenience; the server assigns one if we send none */
      }
      return
    }

    try {
      const res = await getPurchaseOrder(id)
      const o = res.data
      setForm({
        po_number: o.po_number ?? '',
        supplier: o.supplier ? String(o.supplier) : '',
        warehouse: o.warehouse ? String(o.warehouse) : '',
        expected_date: o.expected_date ?? '',
        notes: o.notes ?? '',
      })
      setItems(
        (o.line_items ?? []).map(l => ({
          product: String(l.product),
          quantity_ordered: l.quantity_ordered,
          unit_price: l.unit_price,
        })) || [{ ...EMPTY_ITEM }]
      )
    } catch (err) {
      setErrors({ _: err.response?.data?.detail || 'Could not load this purchase order.' })
    }
  }, [id, isEdit])

  useEffect(() => { loadOrder() }, [loadOrder])

  // ── line items ────────────────────────────────────────────────────────────
  const setItem = (idx, key, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const next = { ...item, [key]: value }
      // Seed the price from the product so the common case needs no typing.
      // It stays editable: what you agreed with the supplier is not the same
      // as your selling price.
      if (key === 'product' && !item.unit_price) {
        const product = products.find(p => String(p.id) === String(value))
        if (product) next.unit_price = product.price
      }
      return next
    }))
  }

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const lineTotal = (item) =>
    Number(item.quantity_ordered || 0) * Number(item.unit_price || 0)
  const grandTotal = items.reduce((sum, item) => sum + lineTotal(item), 0)

  // ── validate & submit ─────────────────────────────────────────────────────
  const validate = () => {
    const next = {}
    if (!form.supplier)  next.supplier = 'Choose a supplier.'
    if (!form.warehouse) next.warehouse = 'Choose the warehouse the goods will arrive at.'

    const usable = items.filter(i => i.product)
    if (!usable.length) next.items = 'Add at least one product.'
    if (usable.some(i => Number(i.quantity_ordered) <= 0)) next.items = 'Quantities must be greater than zero.'
    if (usable.some(i => i.unit_price === '' || Number(i.unit_price) < 0)) next.items = 'Every line needs a unit price.'

    // The API enforces unique_together (purchase_order, product); catching it
    // here gives a clearer message than the DRF integrity error.
    const ids = usable.map(i => String(i.product))
    if (new Set(ids).size !== ids.length) next.items = 'The same product appears on more than one line.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    setErrors({})
    try {
      const payload = {
        po_number: form.po_number || undefined,
        supplier: Number(form.supplier),
        warehouse: Number(form.warehouse),
        expected_date: form.expected_date || null,
        notes: form.notes,
        line_items: items.filter(i => i.product).map(i => ({
          product: Number(i.product),
          quantity_ordered: Number(i.quantity_ordered),
          unit_price: String(i.unit_price),
        })),
      }

      const res = isEdit
        ? await updatePurchaseOrder(id, payload)
        : await createPurchaseOrder(payload)

      setSuccess(true)
      setTimeout(() => navigate(`/purchase-orders/${res.data.id}`), 900)
    } catch (err) {
      setErrors(unwrapErrors(err.response?.data))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/purchase-orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <MdArrowBack /> Purchase Orders
        </Link>
        <span> / {isEdit ? form.po_number || 'Edit' : 'New'}</span>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}</div>
          <div className="page-subtitle">
            A commitment to buy. It does not move stock — receiving does.
          </div>
        </div>
      </div>

      {success && (
        <div style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20, color: 'var(--success)', fontSize: 14,
        }}>
          ✅ Saved. Taking you to the order…
        </div>
      )}

      {errors._ && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20, color: 'var(--danger)', fontSize: 14,
        }}>
          ⚠️ {errors._}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* ── left column ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-title">Order details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="PO Number" error={errors.po_number}>
                  <input className="input" {...field('po_number')} placeholder="Auto-generated" />
                </Field>
                <Field label="Expected delivery" error={errors.expected_date}>
                  <input className="input" type="date" {...field('expected_date')} />
                </Field>
                <Field label="Supplier *" error={errors.supplier}>
                  <select className="select" {...field('supplier')}>
                    <option value="">Select a supplier…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Deliver to warehouse *" error={errors.warehouse}>
                  <select className="select" {...field('warehouse')}>
                    <option value="">Select a warehouse…</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Notes" error={errors.notes}>
                <textarea className="input" rows={2} {...field('notes')} />
              </Field>
            </div>

            <div className="card">
              <div className="card-title">Items</div>
              {errors.line_items && (
                <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>{errors.line_items}</div>
              )}
              {errors.items && (
                <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>{errors.items}</div>
              )}

              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', gap: 10,
                fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8,
              }}>
                <div>Product</div><div>Quantity</div><div>Unit price</div>
                <div style={{ textAlign: 'right' }}>Total</div><div />
              </div>

              {items.map((item, idx) => (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 40px',
                  gap: 10, marginBottom: 8, alignItems: 'center',
                }}>
                  <select className="select" value={item.product} onChange={e => setItem(idx, 'product', e.target.value)}>
                    <option value="">Select a product…</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <input
                    className="input" type="number" min="1" value={item.quantity_ordered}
                    onChange={e => setItem(idx, 'quantity_ordered', e.target.value)}
                  />
                  <input
                    className="input" type="number" min="0" step="0.01" value={item.unit_price}
                    onChange={e => setItem(idx, 'unit_price', e.target.value)} placeholder="0.00"
                  />
                  <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600 }}>
                    {fmtAmount(lineTotal(item))}
                  </div>
                  <button
                    type="button" className="btn btn-outline btn-sm btn-icon"
                    onClick={() => removeItem(idx)} disabled={items.length === 1} title="Remove line"
                  >
                    <MdClose />
                  </button>
                </div>
              ))}

              <button type="button" className="btn btn-outline btn-sm" onClick={addItem} style={{ marginTop: 8 }}>
                <MdAdd /> Add line
              </button>
            </div>
          </div>

          {/* ── right column ────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-title">Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Lines</span>
                <strong>{items.filter(i => i.product).length}</strong>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 18,
                fontWeight: 700, paddingTop: 12, borderTop: '1px solid var(--border)',
              }}>
                <span>Total</span>
                <span>{fmtAmount(grandTotal)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Purchase orders carry no tax — GST is accounted for on the supplier's bill.
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create purchase order'}
            </button>
            <Link to="/purchase-orders" className="btn btn-outline" style={{ width: '100%' }}>Cancel</Link>
          </div>
        </div>
      </form>
    </>
  )
}
