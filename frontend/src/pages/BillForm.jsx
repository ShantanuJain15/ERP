import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { MdAdd, MdClose, MdArrowBack } from 'react-icons/md'
import {
  getSuppliers, getWarehouses, getProducts, getHsnCodes,
  getPurchaseReceives, getPurchaseReceive, createBill, getNextBillNumber,
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
  bill_number: '',
  supplier_bill_number: '',
  supplier_bill_date: '',
  supplier: '',
  warehouse: '',
  updates_stock: false,
  bill_date: new Date().toISOString().slice(0, 10),
  place_of_supply: '',
  discount_amount: '0',
  notes: '',
}

const EMPTY_ITEM = { goods_receipt_line: '', product: '', quantity: 1, unit_price: '', hsn_code: '', gst_rate: '' }

export default function BillForm() {
  const navigate = useNavigate()

  const [form, setForm]     = useState(EMPTY_FORM)
  const [items, setItems]   = useState([{ ...EMPTY_ITEM }])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [sourceGrn, setSourceGrn] = useState('')

  const [suppliers, setSuppliers]   = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [products, setProducts]     = useState([])
  const [hsnCodes, setHsnCodes]     = useState([])
  const [receipts, setReceipts]     = useState([])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const field = (name) => ({ value: form[name] ?? '', onChange: e => set(name, e.target.value) })

  useEffect(() => {
    Promise.all([
      getSuppliers(), getWarehouses(), getProducts(),
      getHsnCodes(), getPurchaseReceives({ status: 'RECEIVED' }),
    ])
      .then(([s, w, p, h, g]) => {
        setSuppliers(rowsOf(s))
        setWarehouses(rowsOf(w))
        setProducts(rowsOf(p))
        setHsnCodes(rowsOf(h))
        setReceipts(rowsOf(g))
      })
      .catch(() => setErrors(e => ({ ...e, _: 'Could not load reference data.' })))

    getNextBillNumber()
      .then(res => setForm(f => ({ ...f, bill_number: res.data.next_number })))
      .catch(() => {})
  }, [])

  // Place of supply defaults to the supplier's state, which is what decides
  // CGST+SGST vs IGST.
  const onSupplierChange = (value) => {
    const supplier = suppliers.find(s => String(s.id) === String(value))
    setForm(f => ({
      ...f,
      supplier: value,
      place_of_supply: f.place_of_supply || supplier?.state_code || '',
    }))
  }

  /** Pull a confirmed receipt's lines in. Doing so rules out posting stock. */
  const loadFromReceipt = useCallback(async (grnId) => {
    if (!grnId) return
    try {
      const res = await getPurchaseReceive(grnId)
      const grn = res.data

      setForm(f => ({
        ...f,
        supplier: String(grn.supplier),
        // These goods have already moved; billing them must not move them again.
        updates_stock: false,
        warehouse: '',
      }))

      setItems((grn.lines ?? []).map(l => {
        const product = products.find(p => String(p.id) === String(l.product))
        const hsn = hsnCodes.find(h => String(h.id) === String(product?.hsn_code))
        return {
          goods_receipt_line: String(l.id),
          product: String(l.product),
          quantity: l.quantity,
          unit_price: l.unit_cost,
          hsn_code: hsn?.code ?? '',
          gst_rate: hsn?.gst_rate ?? '',
        }
      }))
    } catch {
      setErrors(e => ({ ...e, _: 'Could not load that receipt.' }))
    }
  }, [products, hsnCodes])

  const setItem = (idx, key, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const next = { ...item, [key]: value }
      if (key === 'product') {
        const product = products.find(p => String(p.id) === String(value))
        const hsn = hsnCodes.find(h => String(h.id) === String(product?.hsn_code))
        if (hsn) {
          next.hsn_code = next.hsn_code || hsn.code
          next.gst_rate = next.gst_rate || hsn.gst_rate
        }
      }
      return next
    }))
  }

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  // Prices are GST-exclusive, so taxable value is simply qty x price.
  const taxableOf = (item) => Number(item.quantity || 0) * Number(item.unit_price || 0)
  const taxOf = (item) => taxableOf(item) * Number(item.gst_rate || 0) / 100

  const subtotal = items.reduce((s, i) => s + taxableOf(i), 0)
  const taxTotal = items.reduce((s, i) => s + taxOf(i), 0)
  const grandTotal = subtotal + taxTotal - Number(form.discount_amount || 0)

  const linkedToReceipt = items.some(i => i.goods_receipt_line)

  const validate = () => {
    const next = {}
    if (!form.supplier) next.supplier = 'Choose a supplier.'
    if (form.updates_stock && !form.warehouse) {
      next.warehouse = 'A bill that posts stock must say where the goods went.'
    }
    if (form.updates_stock && linkedToReceipt) {
      next.updates_stock = 'These lines came from a receipt, which already moved the stock.'
    }

    const usable = items.filter(i => i.product)
    if (!usable.length) next.items = 'Add at least one product.'
    if (usable.some(i => Number(i.quantity) <= 0)) next.items = 'Quantities must be greater than zero.'
    if (usable.some(i => i.unit_price === '' || Number(i.unit_price) < 0)) next.items = 'Every line needs a unit price.'

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
        bill_number: form.bill_number || undefined,
        supplier_bill_number: form.supplier_bill_number,
        supplier_bill_date: form.supplier_bill_date || null,
        supplier: Number(form.supplier),
        warehouse: form.warehouse ? Number(form.warehouse) : null,
        updates_stock: form.updates_stock,
        bill_date: form.bill_date,
        place_of_supply: form.place_of_supply,
        discount_amount: String(form.discount_amount || 0),
        notes: form.notes,
        lines: items.filter(i => i.product).map(i => ({
          goods_receipt_line: i.goods_receipt_line ? Number(i.goods_receipt_line) : null,
          product: Number(i.product),
          quantity: Number(i.quantity),
          unit_price: String(i.unit_price),
          hsn_code: i.hsn_code || '',
          gst_rate: String(i.gst_rate || 0),
        })),
      }

      const res = await createBill(payload)
      navigate(`/bills/${res.data.id}`)
    } catch (err) {
      setErrors(unwrapErrors(err.response?.data))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/bills" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <MdArrowBack /> Bills
        </Link>
        <span> / New</span>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">New Bill</div>
          <div className="page-subtitle">Saved as a draft. Confirming it creates the payable.</div>
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
              <div className="card-title">Bill details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Bill Number" error={errors.bill_number} hint="Ours, for internal reference">
                  <input className="input" {...field('bill_number')} placeholder="Auto-generated" />
                </Field>
                <Field label="Bill date" error={errors.bill_date}>
                  <input className="input" type="date" {...field('bill_date')} />
                </Field>

                <Field
                  label="Supplier's bill number"
                  error={errors.supplier_bill_number}
                  hint="The number on the document they sent you"
                >
                  <input className="input" {...field('supplier_bill_number')} />
                </Field>
                <Field label="Supplier's bill date" error={errors.supplier_bill_date}>
                  <input className="input" type="date" {...field('supplier_bill_date')} />
                </Field>

                <Field label="Supplier *" error={errors.supplier}>
                  <select className="select" value={form.supplier} onChange={e => onSupplierChange(e.target.value)}>
                    <option value="">Select a supplier…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field
                  label="Place of supply"
                  error={errors.place_of_supply}
                  hint="State code — decides CGST+SGST vs IGST"
                >
                  <input className="input" maxLength={2} {...field('place_of_supply')} placeholder="09" />
                </Field>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Where did these goods come from?</div>
              <div className="card-sub">
                Goods normally arrive on a purchase receive, which is what moves them into stock.
                If they arrived with this bill and no receipt was made, tick the box below.
              </div>

              <Field
                label="Bill a confirmed receipt"
                hint="Pulls its lines in. Those goods are already in stock."
              >
                <select
                  className="select"
                  value={sourceGrn}
                  onChange={e => { setSourceGrn(e.target.value); loadFromReceipt(e.target.value) }}
                >
                  <option value="">Not from a receipt</option>
                  {receipts.map(r => (
                    <option key={r.id} value={r.id}>{r.grn_number} — {r.supplier_name}</option>
                  ))}
                </select>
              </Field>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12,
                cursor: linkedToReceipt ? 'not-allowed' : 'pointer', opacity: linkedToReceipt ? 0.5 : 1,
              }}>
                <input
                  type="checkbox"
                  checked={form.updates_stock}
                  disabled={linkedToReceipt}
                  onChange={e => set('updates_stock', e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ fontSize: 14 }}>
                  <strong>This bill is the receipt — move the goods into stock</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {linkedToReceipt
                      ? 'Unavailable: these lines came from a receipt that already moved the stock.'
                      : 'For a cash or counter purchase with no order and no separate receive.'}
                  </div>
                </span>
              </label>
              {errors.updates_stock && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{errors.updates_stock}</div>
              )}

              {form.updates_stock && (
                <Field label="Received into warehouse *" error={errors.warehouse}>
                  <select className="select" {...field('warehouse')}>
                    <option value="">Select a warehouse…</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <div className="card">
              <div className="card-title">Items</div>
              {(errors.lines || errors.items) && (
                <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>
                  {errors.lines || errors.items}
                </div>
              )}

              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 0.7fr 1fr 0.8fr 0.7fr 1fr 40px', gap: 8,
                fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8,
              }}>
                <div>Product</div><div>Qty</div><div>Unit price</div>
                <div>HSN</div><div>GST %</div>
                <div style={{ textAlign: 'right' }}>Total</div><div />
              </div>

              {items.map((item, idx) => (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '2fr 0.7fr 1fr 0.8fr 0.7fr 1fr 40px',
                  gap: 8, marginBottom: 8, alignItems: 'center',
                }}>
                  <select className="select" value={item.product} onChange={e => setItem(idx, 'product', e.target.value)}>
                    <option value="">Select…</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <input className="input" type="number" min="1" value={item.quantity}
                    onChange={e => setItem(idx, 'quantity', e.target.value)} />
                  <input className="input" type="number" min="0" step="0.01" value={item.unit_price}
                    onChange={e => setItem(idx, 'unit_price', e.target.value)} placeholder="0.00" />
                  <input className="input" value={item.hsn_code}
                    onChange={e => setItem(idx, 'hsn_code', e.target.value)} placeholder="8415" />
                  <input className="input" type="number" min="0" step="0.01" value={item.gst_rate}
                    onChange={e => setItem(idx, 'gst_rate', e.target.value)} placeholder="18" />
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                    {fmtAmount(taxableOf(item) + taxOf(item))}
                  </div>
                  <button type="button" className="btn btn-outline btn-sm btn-icon"
                    onClick={() => removeItem(idx)} disabled={items.length === 1} title="Remove line">
                    <MdClose />
                  </button>
                </div>
              ))}

              <button type="button" className="btn btn-outline btn-sm" onClick={addItem} style={{ marginTop: 8 }}>
                <MdAdd /> Add line
              </button>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                Unit prices are GST-exclusive. The tax split is computed on save and snapshotted onto
                each line, so this bill keeps the rate it was raised with even if rates change later.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-title">Summary</div>
              {[
                ['Taxable value', fmtAmount(subtotal)],
                ['GST', fmtAmount(taxTotal)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}

              <Field label="Discount" error={errors.discount_amount}>
                <input className="input" type="number" min="0" step="0.01" {...field('discount_amount')} />
              </Field>

              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 18,
                fontWeight: 700, paddingTop: 12, borderTop: '1px solid var(--border)',
              }}>
                <span>Total</span>
                <span>{fmtAmount(grandTotal)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Server-side totals are authoritative — this preview may round differently.
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save as draft'}
            </button>
            <Link to="/bills" className="btn btn-outline" style={{ width: '100%' }}>Cancel</Link>
          </div>
        </div>
      </form>
    </>
  )
}
