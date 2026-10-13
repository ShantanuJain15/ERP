import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MdArrowBack, MdEdit, MdSend, MdCallReceived, MdBlock, MdDoneAll } from 'react-icons/md'
import {
  getPurchaseOrder, submitPurchaseOrder, cancelPurchaseOrder, closePurchaseOrder,
} from '../api/inventory'
import { fmt, fmtAmount, PO_STATUS_BADGE, statusLabel } from '../utils/purchase'

export default function PurchaseOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [order, setOrder]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [busy, setBusy]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPurchaseOrder(id)
      setOrder(res.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load this purchase order.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // One `busy` flag gates every mutation, so two actions can't race.
  const act = async (fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fn(id)
      setOrder(res.data)
    } catch (err) {
      const data = err.response?.data
      setError(data?.status || data?.detail || Object.values(data || {})[0] || 'That action failed.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="skeleton" style={{ height: 300, borderRadius: 12 }} />
  if (!order) return <div className="empty-state"><div className="empty-state-text">{error || 'Not found'}</div></div>

  const received = order.line_items?.reduce((s, l) => s + (l.quantity_received || 0), 0) ?? 0
  const ordered  = order.line_items?.reduce((s, l) => s + (l.quantity_ordered || 0), 0) ?? 0
  const isDraft  = order.status === 'DRAFT'
  const isOpen   = ['SUBMITTED', 'PARTIALLY_RECEIVED'].includes(order.status)

  return (
    <>
      <div className="breadcrumb">
        <Link to="/purchase-orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <MdArrowBack /> Purchase Orders
        </Link>
        <span> / {order.po_number}</span>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {order.po_number}
            <span className={`badge ${PO_STATUS_BADGE[order.status] || 'badge-neutral'}`}>
              {statusLabel(order.status)}
            </span>
          </div>
          <div className="page-subtitle">{order.supplier_name} · {order.warehouse_name}</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {isDraft && (
            <>
              <Link to={`/purchase-orders/${order.id}/edit`} className="btn btn-outline btn-sm">
                <MdEdit /> Edit
              </Link>
              <button className="btn btn-primary btn-sm" disabled={busy}
                onClick={() => act(submitPurchaseOrder)}>
                <MdSend /> Submit
              </button>
            </>
          )}
          {isOpen && (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/purchase-receives/new?po=${order.id}`)}
              >
                <MdCallReceived /> Receive goods
              </button>
              <button className="btn btn-outline btn-sm" disabled={busy}
                onClick={() => act(closePurchaseOrder, 'Close this order short? The undelivered balance will not be expected.')}>
                <MdDoneAll /> Close short
              </button>
            </>
          )}
          {(isDraft || order.status === 'SUBMITTED') && received === 0 && (
            <button className="btn btn-danger btn-sm" disabled={busy}
              onClick={() => act(cancelPurchaseOrder, 'Cancel this purchase order?')}>
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
          ⚠️ {error}
        </div>
      )}

      {order.status === 'DRAFT' && (
        <div style={{
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: 14,
        }}>
          This order is a draft — it hasn't been sent to the supplier and nothing can be received
          against it yet. <strong>Submit</strong> it when you're ready.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">Items</div>
          <div className="table-wrapper">
            {/* The wrapper scrolls; without a floor the product column collapses. */}
            <table style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Product</th>
                  <th style={{ textAlign: 'right' }}>Ordered</th>
                  <th style={{ textAlign: 'right' }}>Received</th>
                  <th style={{ textAlign: 'right' }}>Pending</th>
                  <th style={{ textAlign: 'right' }}>Unit price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.line_items ?? []).map(l => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.product_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.product_sku}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{l.quantity_ordered}</td>
                    <td style={{ textAlign: 'right', color: l.quantity_received > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {l.quantity_received}
                    </td>
                    <td style={{ textAlign: 'right', color: l.quantity_pending > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {l.quantity_pending}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtAmount(l.unit_price)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAmount(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-title">Summary</div>
            {[
              ['Supplier', order.supplier_name],
              ['Warehouse', order.warehouse_name],
              ['Expected', fmt(order.expected_date)],
              ['Progress', `${received} of ${ordered} received`],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', gap: 16,
                fontSize: 14, marginBottom: 8,
              }}>
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
                <strong style={{ textAlign: 'right' }}>{value || '—'}</strong>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 18,
              fontWeight: 700, paddingTop: 12, borderTop: '1px solid var(--border)',
            }}>
              <span>Total</span>
              <span>{fmtAmount(order.total_amount)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="card">
              <div className="card-title">Notes</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{order.notes}</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
