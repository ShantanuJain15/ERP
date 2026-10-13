import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MdArrowBack, MdCheck, MdBlock, MdPayments } from 'react-icons/md'
import { getBill, confirmBill, cancelBill } from '../api/inventory'
import {
  fmt, fmtAmount, BILL_STATUS_BADGE, statusLabel, balanceOf, displayBillStatus,
} from '../utils/purchase'

export default function BillDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [bill, setBill]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [busy, setBusy]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getBill(id)
      setBill(res.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load this bill.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const act = async (fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fn(id)
      setBill(res.data)
    } catch (err) {
      const data = err.response?.data
      setError(
        data?.status || data?.lines || data?.updates_stock || data?.warehouse ||
        data?.detail || Object.values(data || {})[0] || 'That action failed.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="skeleton" style={{ height: 300, borderRadius: 12 }} />
  if (!bill) return <div className="empty-state"><div className="empty-state-text">{error || 'Not found'}</div></div>

  const display = displayBillStatus(bill)
  const hasIgst = (bill.lines ?? []).some(l => Number(l.igst_amount) > 0)

  return (
    <>
      <div className="breadcrumb">
        <Link to="/bills" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <MdArrowBack /> Bills
        </Link>
        <span> / {bill.bill_number}</span>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {bill.bill_number}
            <span className={`badge ${BILL_STATUS_BADGE[bill.status] || 'badge-neutral'}`}>
              {statusLabel(bill.status)}
            </span>
          </div>
          <div className="page-subtitle">
            {bill.supplier_name}
            {bill.supplier_bill_number && ` · their ref ${bill.supplier_bill_number}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {bill.status === 'DRAFT' && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(confirmBill)}>
              <MdCheck /> Confirm
            </button>
          )}
          {['RECEIVED', 'PARTIALLY_PAID'].includes(bill.status) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/payments-out/new?supplier=${bill.supplier}&bill=${bill.id}`)}
            >
              <MdPayments /> Record payment
            </button>
          )}
          {bill.status !== 'CANCELLED' && (
            <button
              className="btn btn-danger btn-sm" disabled={busy}
              onClick={() => act(
                cancelBill,
                bill.updates_stock && bill.status !== 'DRAFT'
                  ? 'Cancel this bill? A reversing stock movement will be recorded.'
                  : 'Cancel this bill?',
              )}
            >
              <MdBlock /> Cancel
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20, color: 'var(--danger)', fontSize: 14,
        }}>
          ⚠️ {String(error)}
        </div>
      )}

      {bill.updates_stock && (
        <div style={{
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: 14,
        }}>
          This bill <strong>is the receipt</strong> — no purchase receive was made, so confirming it
          moved the goods into {bill.warehouse_name || 'the warehouse'} itself.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">Items</div>
          <div className="table-wrapper">
            {/* The wrapper scrolls; without a floor the product column collapses. */}
            <table style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Product</th>
                  <th>HSN</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Taxable</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(bill.lines ?? []).map(l => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.product_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.product_sku}</div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{l.hsn_code || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{l.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{fmtAmount(l.unit_price)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtAmount(l.taxable_amount)}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>
                      {Number(l.igst_amount) > 0
                        ? <>IGST {fmtAmount(l.igst_amount)}</>
                        : <>
                            <div>CGST {fmtAmount(l.cgst_amount)}</div>
                            <div>SGST {fmtAmount(l.sgst_amount)}</div>
                          </>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAmount(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            {hasIgst
              ? 'Inter-state supply — IGST applies.'
              : 'Intra-state supply — CGST and SGST apply in equal halves.'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-title">Totals</div>
            {[
              ['Taxable value', fmtAmount(bill.subtotal)],
              ['GST', fmtAmount(bill.tax_total)],
              ['Discount', fmtAmount(bill.discount_amount)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 18,
              fontWeight: 700, paddingTop: 12, borderTop: '1px solid var(--border)',
            }}>
              <span>Total</span>
              <span>{fmtAmount(bill.total_amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 14, marginTop: 10 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Paid</span>
              <strong style={{ color: 'var(--success)' }}>{fmtAmount(bill.paid_amount)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 16, fontWeight: 700 }}>
              <span>Balance due</span>
              <span style={{ color: balanceOf(bill) > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {fmtAmount(balanceOf(bill))}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Details</div>
            {[
              ['Bill date', fmt(bill.bill_date)],
              ['Due', bill.due_date ? fmt(bill.due_date) : '—'],
              ['Status', display.label],
              ['Place of supply', bill.place_of_supply || '—'],
              ['Warehouse', bill.warehouse_name || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', gap: 16,
                fontSize: 14, marginBottom: 8,
              }}>
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
                <strong style={{ textAlign: 'right' }}>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
