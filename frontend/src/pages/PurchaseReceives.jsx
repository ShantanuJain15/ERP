import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MdAdd, MdSearch, MdRefresh, MdCheck, MdBlock } from 'react-icons/md'
import { getPurchaseReceives, confirmPurchaseReceive, cancelPurchaseReceive } from '../api/inventory'
import { fmt, fmtAmount, GRN_STATUS_BADGE, statusLabel, rowsOf } from '../utils/purchase'

export default function PurchaseReceives() {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [busyId, setBusyId]     = useState(null)

  const fetchReceipts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPurchaseReceives()
      setReceipts(rowsOf(res))
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch purchase receives')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReceipts() }, [fetchReceipts])

  const act = async (id, fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fn(id)
      setReceipts(prev => prev.map(r => (r.id === id ? res.data : r)))
    } catch (err) {
      const data = err.response?.data
      setError(data?.status || data?.lines || data?.detail || Object.values(data || {})[0] || 'That action failed.')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = receipts.filter(r => {
    const q = search.toLowerCase()
    return (r.grn_number || '').toLowerCase().includes(q) ||
      (r.supplier_name || '').toLowerCase().includes(q) ||
      (r.supplier_dc_number || '').toLowerCase().includes(q)
  })

  const drafts = receipts.filter(r => r.status === 'DRAFT').length
  const posted = receipts.filter(r => r.status === 'RECEIVED').length

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Purchase Receives</div>
          <div className="page-subtitle">Goods arriving — confirming one moves stock in</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchReceipts} title="Refresh">
            <MdRefresh />
          </button>
          <Link to="/purchase-receives/new" className="btn btn-primary"><MdAdd /> New Receive</Link>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          color: 'var(--danger)', fontSize: 14, display: 'flex', justifyContent: 'space-between',
        }}>
          ⚠️ {String(error)}
          <button onClick={fetchReceipts} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input
            placeholder="Search by GRN, supplier or challan number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="info-pill">Total: <strong>{receipts.length}</strong></div>
        <div className="info-pill">Awaiting confirmation: <strong style={{ color: 'var(--warning)' }}>{drafts}</strong></div>
        <div className="info-pill">Posted: <strong style={{ color: 'var(--success)' }}>{posted}</strong></div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>GRN</th>
              <th>Supplier</th>
              <th>Against PO</th>
              <th>Challan</th>
              <th>Received</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-text">No purchase receives yet</div>
                  <div className="empty-state-sub">
                    {search ? 'Try adjusting your search' : 'Record goods arriving to move them into stock'}
                  </div>
                </div>
              </td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.grn_number}</td>
                <td>{r.supplier_name || '—'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{r.po_number || <em style={{ color: 'var(--text-muted)' }}>no order</em>}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{r.supplier_dc_number || '—'}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt(r.received_date)}</td>
                <td>
                  <span className={`badge ${GRN_STATUS_BADGE[r.status] || 'badge-neutral'}`}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAmount(r.total_cost)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {r.status === 'DRAFT' && (
                      <button
                        className="btn btn-primary btn-sm" disabled={busyId === r.id}
                        title="Confirm — posts stock in"
                        onClick={() => act(r.id, confirmPurchaseReceive)}
                      >
                        <MdCheck /> Confirm
                      </button>
                    )}
                    {r.status !== 'CANCELLED' && (
                      <button
                        className="btn btn-danger btn-sm btn-icon" disabled={busyId === r.id}
                        title="Cancel — writes a reversing stock movement"
                        onClick={() => act(
                          r.id, cancelPurchaseReceive,
                          r.status === 'RECEIVED'
                            ? 'Cancel this receipt? A reversing stock movement will be recorded — the original is never deleted.'
                            : 'Cancel this draft receipt?',
                        )}
                      >
                        <MdBlock />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
