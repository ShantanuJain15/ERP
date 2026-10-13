import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { MdAdd, MdClose, MdArrowBack } from 'react-icons/md'
import {
  getSuppliers, getWarehouses, getProducts, getPurchaseOrders, getPurchaseOrder,
  createPurchaseReceive, getNextGrnNumber,
} from '../api/inventory'
import { fmtAmount, rowsOf, unwrapErrors } from '../utils/purchase'

const Field = ({ label, error, children, hint }) => (
  <div className="form-group">
    <label>{label}</label>
    {children}
    {hint && !error && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
  </div>
)

const EMPTY_FORM = {
  grn_number: '',
  purchase_order: '',
  supplier: '',
  warehouse: '',
  received_date: new Date().toISOString().slice(0, 10),
  supplier_dc_number: '',
  notes: '',
}

const EMPTY_ITEM = { po_line_item: '', product: '', quantity: 1, unit_cost: '' }

export default function PurchaseReceiveForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetPo = params.get('po')

  const [form, setForm]     = useState({ ...EMPTY_FORM, purchase_order: presetPo || '' })
  const [items, setItems]   = useState([{ ...EMPTY_ITEM }])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [suppliers, setSuppliers]   = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [products, setProducts]     = useState([])
  const [openOrders, setOpenOrders] = useState([])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const field = (name) => ({ value: form[name] ?? '', onChange: e => set(name, e.target.value) })

  useEffect(() => {
    Promise.all([getSuppliers(), getWarehouses(), getProducts(), getPurchaseOrders({ open: 'true' })])
      .then(([s, w, p, o]) => {
        setSuppliers(rowsOf(s))
        setWarehouses(rowsOf(w))
        setProducts(rowsOf(p))
        setOpenOrders(rowsOf(o))
      })
      .catch(() => setErrors(e => ({ ...e, _: 'Could not load reference data.' })))

    getNextGrnNumber()
      .then(res => setForm(f => ({ ...f, grn_number: res.data.next_number })))
      .catch(() => {})
  }, [])

  /**
   * Pull the order's outstanding lines in as receipt lines.
   *
   * Quantity defaults to what's still pending, and unit_cost to the agreed PO
   * price — but both stay editable, because what arrived and what it cost are
   * facts about the delivery, not about the order.
   */
  const loadFromOrder = useCallback(async (orderId) => {
    if (!orderId) return
    try {
      const res = await getPurchaseOrder(orderId)
      const order = res.data
      setForm(f => ({
        ...f,
        supplier: String(order.supplier),
        warehouse: String(order.warehouse),
      }))

      const pending = (order.line_items ?? []).filter(l => l.quantity_pending > 0)
      setItems(
        pending.length
          ? pending.map(l => ({
              po_line_item: String(l.id),
              product: String(l.product),
              quantity: l.quantity_pending,
              unit_cost: l.unit_price,
            }))
          : [{ ...EMPTY_ITEM }]
      )
    } catch {
      setErrors(e => ({ ...e, _: 'Could not load that purchase order.' }))
    }
  }, [])

  useEffect(() => {
    if (form.purchase_order) loadFromOrder(form.purchase_order)
  }, [form.purchase_order, loadFromOrder])

  const setItem = (idx, key, value) => {
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)))
  }
  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const lineCost = (item) => Number(item.quantity || 0) * Number(item.unit_cost || 0)
  const totalCost = items.reduce((sum, item) => sum + lineCost(item), 0)

  const validate = () => {
    const next = {}
    if (!form.supplier)  next.supplier = 'Choose the supplier the goods came from.'
    if (!form.warehouse) next.warehouse = 'Choose the warehouse the goods arrived at.'

    const usable = items.filter(i => i.product)
    if (!usable.length) next.items = 'Add at least one product.'
    if (usable.some(i => Number(i.quantity) <= 0)) next.items = 'Quantities must be greater than zero.'
    if (usable.some(i => i.unit_cost === '' || Number(i.unit_cost) < 0)) {
      next.items = 'Every line needs a unit cost — this is what makes stock valuation possible.'
    }

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
        grn_number: form.grn_number || undefined,
        purchase_order: form.purchase_order ? Number(form.purchase_order) : null,
        supplier: Number(form.supplier),
        warehouse: Number(form.warehouse),
        received_date: form.received_date,
        supplier_dc_number: form.supplier_dc_number,
        notes: form.notes,
        lines: items.filter(i => i.product).map(i => ({
          po_line_item: i.po_line_item ? Number(i.po_line_item) : null,
          product: Number(i.product),
          quantity: Number(i.quantity),
          unit_cost: String(i.unit_cost),
        })),
      }

      await createPurchaseReceive(payload)
      navigate('/purchase-receives')
    } catch (err) {
      setErrors(unwrapErrors(err.response?.data))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/purchase-receives" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <MdArrowBack /> Purchase Receives
        </Link>
        <span> / New</span>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">New Purchase Receive</div>
          <div className="page-subtitle">
            Saved as a draft. Confirming it is what moves stock in.
          </div>
        </div>
      </div>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-title">Receipt details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="GRN Number" error={errors.grn_number}>
                  <input className="input" {...field('grn_number')} placeholder="Auto-generated" />
                </Field>
                <Field label="Received on" error={errors.received_date}>
                  <input className="input" type="date" {...field('received_date')} />
                </Field>

                <Field
                  label="Against purchase order"
                  error={errors.purchase_order}
                  hint="Leave blank for a cash or emergency buy with no order."
                >
                  <select className="select" {...field('purchase_order')}>
                    <option value="">No purchase order</option>
                    {openOrders.map(o => (
                      <option key={o.id} value={o.id}>{o.po_number} — {o.supplier_name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Supplier's challan no." error={errors.supplier_dc_number}>
                  <input className="input" {...field('supplier_dc_number')} placeholder="From their delivery note" />
                </Field>

                <Field label="Supplier *" error={errors.supplier}>
                  <select className="select" {...field('supplier')}>
                    <option value="">Select a supplier…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Received into warehouse *" error={errors.warehouse}>
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
              <div className="card-title">What arrived</div>
              {(errors.lines || errors.items) && (
                <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>
                  {errors.lines || errors.items}
                </div>
              )}

              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', gap: 10,
                fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8,
              }}>
                <div>Product</div><div>Quantity</div><div>Unit cost</div>
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
                    className="input" type="number" min="1" value={item.quantity}
                    onChange={e => setItem(idx, 'quantity', e.target.value)}
                  />
                  <input
                    className="input" type="number" min="0" step="0.01" value={item.unit_cost}
                    onChange={e => setItem(idx, 'unit_cost', e.target.value)} placeholder="0.00"
                  />
                  <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600 }}>
                    {fmtAmount(lineCost(item))}
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

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                Unit cost is what you actually paid, excluding GST. It may differ from the price on the
                order — and it's the number that makes stock valuation and margin computable.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-title">Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Lines</span>
                <strong>{items.filter(i => i.product).length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Units</span>
                <strong>{items.reduce((s, i) => s + Number(i.quantity || 0), 0)}</strong>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 18,
                fontWeight: 700, paddingTop: 12, borderTop: '1px solid var(--border)',
              }}>
                <span>Stock value</span>
                <span>{fmtAmount(totalCost)}</span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save as draft'}
            </button>
            <Link to="/purchase-receives" className="btn btn-outline" style={{ width: '100%' }}>Cancel</Link>
          </div>
        </div>
      </form>
    </>
  )
}
