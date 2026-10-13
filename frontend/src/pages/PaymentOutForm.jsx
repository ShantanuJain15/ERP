import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { MdArrowBack } from 'react-icons/md'
import {
  getSuppliers, getBills, createPaymentOut, getNextPayoutNumber,
} from '../api/inventory'
import { fmt, fmtAmount, rowsOf, unwrapErrors, balanceOf } from '../utils/purchase'

const Field = ({ label, error, children, hint }) => (
  <div className="form-group">
    <label>{label}</label>
    {children}
    {hint && !error && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
  </div>
)

const METHODS = [
  ['NEFT', 'NEFT / RTGS'], ['UPI', 'UPI'], ['CASH', 'Cash'],
  ['CHEQUE', 'Cheque'], ['CARD', 'Card'],
]

export default function PaymentOutForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [form, setForm] = useState({
    payment_number: '',
    supplier: params.get('supplier') || '',
    amount: '',
    method: 'NEFT',
    paid_date: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
  })
  // { [billId]: amountString } — only entries with a value become allocations.
  const [allocations, setAllocations] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [suppliers, setSuppliers] = useState([])
  const [openBills, setOpenBills] = useState([])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const field = (name) => ({ value: form[name] ?? '', onChange: e => set(name, e.target.value) })

  useEffect(() => {
    getSuppliers().then(res => setSuppliers(rowsOf(res))).catch(() => {})
    getNextPayoutNumber()
      .then(res => setForm(f => ({ ...f, payment_number: res.data.next_number })))
      .catch(() => {})
  }, [])

  // Only a supplier's own open bills can take their payment.
  const loadBills = useCallback(async (supplierId) => {
    if (!supplierId) { setOpenBills([]); return }
    try {
      const res = await getBills({ supplier: supplierId, open: 'true' })
      const bills = rowsOf(res)
      setOpenBills(bills)

      // Deep-linked from a bill: pre-fill its full balance.
      const preset = params.get('bill')
      if (preset) {
        const bill = bills.find(b => String(b.id) === String(preset))
        if (bill) {
          setAllocations({ [bill.id]: String(balanceOf(bill)) })
          setForm(f => ({ ...f, amount: f.amount || String(balanceOf(bill)) }))
        }
      }
    } catch {
      setErrors(e => ({ ...e, _: 'Could not load this supplier\'s open bills.' }))
    }
  }, [params])

  useEffect(() => { loadBills(form.supplier) }, [form.supplier, loadBills])

  const setAllocation = (billId, value) =>
    setAllocations(prev => ({ ...prev, [billId]: value }))

  const allocatedTotal = Object.values(allocations)
    .reduce((s, v) => s + Number(v || 0), 0)
  const unallocated = Number(form.amount || 0) - allocatedTotal

  const autoAllocate = () => {
    // Oldest bill first — the ordinary way of settling a supplier account.
    let remaining = Number(form.amount || 0)
    const next = {}
    for (const bill of [...openBills].sort((a, b) => new Date(a.due_date ?? 0) - new Date(b.due_date ?? 0))) {
      if (remaining <= 0) break
      const take = Math.min(remaining, balanceOf(bill))
      if (take > 0) {
        next[bill.id] = String(take)
        remaining -= take
      }
    }
    setAllocations(next)
  }

  const validate = () => {
    const next = {}
    if (!form.supplier) next.supplier = 'Choose a supplier.'
    if (!form.amount || Number(form.amount) <= 0) next.amount = 'Enter the amount you paid.'
    if (allocatedTotal > Number(form.amount || 0)) {
      next.allocations = `Allocated ${fmtAmount(allocatedTotal)} exceeds the payment of ${fmtAmount(form.amount)}.`
    }

    for (const bill of openBills) {
      const value = Number(allocations[bill.id] || 0)
      if (value > balanceOf(bill)) {
        next.allocations = `${bill.bill_number}: ${fmtAmount(value)} is more than its balance of ${fmtAmount(balanceOf(bill))}.`
      }
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
      await createPaymentOut({
        payment_number: form.payment_number || undefined,
        supplier: Number(form.supplier),
        amount: String(form.amount),
        method: form.method,
        paid_date: form.paid_date,
        reference: form.reference,
        notes: form.notes,
        allocations: Object.entries(allocations)
          .filter(([, amount]) => Number(amount) > 0)
          .map(([bill, amount]) => ({ bill: Number(bill), amount: String(amount) })),
      })
      navigate('/payments-out')
    } catch (err) {
      setErrors(unwrapErrors(err.response?.data))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/payments-out" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <MdArrowBack /> Payments Out
        </Link>
        <span> / New</span>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">Record Payment</div>
          <div className="page-subtitle">
            One payment can settle several bills — allocate it across them below.
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
              <div className="card-title">Payment details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Payment Number" error={errors.payment_number}>
                  <input className="input" {...field('payment_number')} placeholder="Auto-generated" />
                </Field>
                <Field label="Paid on" error={errors.paid_date}>
                  <input className="input" type="date" {...field('paid_date')} />
                </Field>

                <Field label="Supplier *" error={errors.supplier}>
                  <select className="select" {...field('supplier')}>
                    <option value="">Select a supplier…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Amount *" error={errors.amount}>
                  <input className="input" type="number" min="0" step="0.01" {...field('amount')} placeholder="0.00" />
                </Field>

                <Field label="Method" error={errors.method}>
                  <select className="select" {...field('method')}>
                    {METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Reference" error={errors.reference} hint="UTR, cheque number or transaction id">
                  <input className="input" {...field('reference')} />
                </Field>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="card-title">Allocate to bills</div>
                  <div className="card-sub">Leave a bill blank to skip it.</div>
                </div>
                <button
                  type="button" className="btn btn-outline btn-sm"
                  onClick={autoAllocate} disabled={!openBills.length || !form.amount}
                >
                  Auto-allocate oldest first
                </button>
              </div>

              {errors.allocations && (
                <div style={{ fontSize: 13, color: 'var(--danger)', margin: '10px 0' }}>{errors.allocations}</div>
              )}

              {!form.supplier ? (
                <div className="empty-state">
                  <div className="empty-state-text">Choose a supplier first</div>
                  <div className="empty-state-sub">Their open bills will appear here.</div>
                </div>
              ) : openBills.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-text">Nothing outstanding</div>
                  <div className="empty-state-sub">
                    This supplier has no open bills. The payment will be recorded unallocated.
                  </div>
                </div>
              ) : (
                <div className="table-wrapper" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Bill</th>
                        <th>Due</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th style={{ width: 150 }}>Allocate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openBills.map(bill => (
                        <tr key={bill.id}>
                          <td style={{ fontWeight: 600 }}>{bill.bill_number}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt(bill.due_date)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtAmount(bill.total_amount)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{fmtAmount(balanceOf(bill))}</td>
                          <td>
                            <input
                              className="input" type="number" min="0" step="0.01"
                              max={balanceOf(bill)} placeholder="0.00"
                              value={allocations[bill.id] ?? ''}
                              onChange={e => setAllocation(bill.id, e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-title">Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment</span>
                <strong>{fmtAmount(form.amount || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Allocated</span>
                <strong>{fmtAmount(allocatedTotal)}</strong>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 16,
                fontWeight: 700, paddingTop: 12, borderTop: '1px solid var(--border)',
              }}>
                <span>Unallocated</span>
                <span style={{ color: unallocated < 0 ? 'var(--danger)' : unallocated > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {fmtAmount(unallocated)}
                </span>
              </div>
              {unallocated < 0 && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>
                  You've allocated more than the payment amount.
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              {saving ? 'Saving…' : 'Record payment'}
            </button>
            <Link to="/payments-out" className="btn btn-outline" style={{ width: '100%' }}>Cancel</Link>
          </div>
        </div>
      </form>
    </>
  )
}
