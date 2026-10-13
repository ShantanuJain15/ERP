import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MdAdd, MdSearch, MdEdit, MdDelete, MdRefresh, MdVisibility } from 'react-icons/md'
import { getPurchaseOrders, deletePurchaseOrder } from '../api/inventory'
import { fmt, fmtAmount, PO_STATUS_BADGE, statusLabel, rowsOf } from '../utils/purchase'

const STATUSES = ['DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED']

export default function PurchaseOrders() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPurchaseOrders()
      setOrders(rowsOf(res))
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch purchase orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const matchesSearch =
      (o.po_number || '').toLowerCase().includes(q) ||
      (o.supplier_name || '').toLowerCase().includes(q)
    return matchesSearch && (!status || o.status === status)
  })

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deletePurchaseOrder(deleteId)
      setOrders(p => p.filter(x => x.id !== deleteId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const open = orders.filter(o => ['SUBMITTED', 'PARTIALLY_RECEIVED'].includes(o.status)).length
  const drafts = orders.filter(o => o.status === 'DRAFT').length

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Purchase Orders</div>
          <div className="page-subtitle">{orders.length} total orders</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchOrders} title="Refresh">
            <MdRefresh />
          </button>
          <Link to="/purchase-orders/new" className="btn btn-primary"><MdAdd /> New Purchase Order</Link>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          color: 'var(--danger)', fontSize: 14, display: 'flex', justifyContent: 'space-between'
        }}>
          ⚠️ {error}
          <button onClick={fetchOrders} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input
            placeholder="Search by PO number or supplier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="select" style={{ maxWidth: 220 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="info-pill">Total: <strong>{orders.length}</strong></div>
        <div className="info-pill">Open: <strong style={{ color: 'var(--warning)' }}>{open}</strong></div>
        <div className="info-pill">Drafts: <strong style={{ color: 'var(--text-muted)' }}>{drafts}</strong></div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Warehouse</th>
              <th>Status</th>
              <th>Expected</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-text">No purchase orders found</div>
                  <div className="empty-state-sub">
                    {search || status ? 'Try adjusting your filters' : 'Raise your first purchase order to get started'}
                  </div>
                </div>
              </td></tr>
            ) : filtered.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 600 }}>{o.po_number}</td>
                <td>{o.supplier_name || '—'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{o.warehouse_name || '—'}</td>
                <td>
                  <span className={`badge ${PO_STATUS_BADGE[o.status] || 'badge-neutral'}`}>
                    {statusLabel(o.status)}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt(o.expected_date)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAmount(o.total_amount)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/purchase-orders/${o.id}`} className="btn btn-outline btn-sm btn-icon" title="View">
                      <MdVisibility />
                    </Link>
                    {o.status === 'DRAFT' && (
                      <>
                        <Link to={`/purchase-orders/${o.id}/edit`} className="btn btn-outline btn-sm btn-icon" title="Edit">
                          <MdEdit />
                        </Link>
                        <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => setDeleteId(o.id)}>
                          <MdDelete />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--danger)', fontSize: 24 }}>⚠️</span>
              Delete Purchase Order
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Are you sure? Only draft orders can be deleted — anything already sent to a supplier
              should be cancelled instead, so the record survives.
            </p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
