import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MdAdd, MdSearch, MdRefresh, MdVisibility } from 'react-icons/md'
import { getBills, getSupplierOutstanding } from '../api/inventory'
import {
  fmt, fmtAmount, BILL_STATUS_BADGE, statusLabel, rowsOf, balanceOf, displayBillStatus,
} from '../utils/purchase'

/** A bill is a live payable only once confirmed and not cancelled. */
const isOpen = (bill) => ['RECEIVED', 'PARTIALLY_PAID'].includes(bill.status)

export default function Bills() {
  const [bills, setBills]     = useState([])
  const [outstanding, setOutstanding] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')

  const fetchBills = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [billsRes, outRes] = await Promise.all([getBills(), getSupplierOutstanding()])
      setBills(rowsOf(billsRes))
      setOutstanding(Array.isArray(outRes.data) ? outRes.data : [])
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch bills')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBills() }, [fetchBills])

  const filtered = bills.filter(b => {
    const q = search.toLowerCase()
    return (b.bill_number || '').toLowerCase().includes(q) ||
      (b.supplier_bill_number || '').toLowerCase().includes(q) ||
      (b.supplier_name || '').toLowerCase().includes(q)
  })

  const totalOwed = outstanding.reduce((s, r) => s + Number(r.outstanding || 0), 0)
  const overdue = bills.filter(b =>
    isOpen(b) && b.due_date && new Date(b.due_date) < new Date()
  ).length

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Bills</div>
          <div className="page-subtitle">What your suppliers have charged you</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchBills} title="Refresh">
            <MdRefresh />
          </button>
          <Link to="/bills/new" className="btn btn-primary"><MdAdd /> New Bill</Link>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          color: 'var(--danger)', fontSize: 14, display: 'flex', justifyContent: 'space-between',
        }}>
          ⚠️ {error}
          <button onClick={fetchBills} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input
            placeholder="Search by bill number or supplier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="info-pill">Total: <strong>{bills.length}</strong></div>
        <div className="info-pill">
          Outstanding: <strong style={{ color: 'var(--warning)' }}>{fmtAmount(totalOwed)}</strong>
        </div>
        {overdue > 0 && (
          <div className="info-pill">Overdue: <strong style={{ color: 'var(--danger)' }}>{overdue}</strong></div>
        )}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Bill</th>
              <th>Supplier</th>
              <th>Their ref</th>
              <th>Date</th>
              <th>Due</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9}>
                <div className="empty-state">
                  <div className="empty-state-icon">🧾</div>
                  <div className="empty-state-text">No bills yet</div>
                  <div className="empty-state-sub">
                    {search ? 'Try adjusting your search' : "Record a supplier's invoice to create a payable"}
                  </div>
                </div>
              </td></tr>
            ) : filtered.map(b => {
              const display = displayBillStatus(b)
              return (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>
                    {b.bill_number}
                    {b.updates_stock && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>posts stock</div>
                    )}
                  </td>
                  <td>{b.supplier_name || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{b.supplier_bill_number || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt(b.bill_date)}</td>
                  <td style={{ fontSize: 13, color: display.tone }}>{display.label}</td>
                  <td>
                    <span className={`badge ${BILL_STATUS_BADGE[b.status] || 'badge-neutral'}`}>
                      {statusLabel(b.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAmount(b.total_amount)}</td>
                  {/* Only a confirmed, uncancelled bill is a payable. A draft
                      isn't owed yet and a cancelled one never will be, so
                      showing either as an outstanding balance is misleading. */}
                  <td style={{
                    textAlign: 'right',
                    color: isOpen(b) && balanceOf(b) > 0 ? 'var(--warning)' : 'var(--text-muted)',
                  }}>
                    {isOpen(b) || b.status === 'PAID' ? fmtAmount(balanceOf(b)) : '—'}
                  </td>
                  <td>
                    <Link to={`/bills/${b.id}`} className="btn btn-outline btn-sm btn-icon" title="View">
                      <MdVisibility />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {outstanding.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-title">Supplier outstanding</div>
          <div className="card-sub">What you owe, by supplier</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th style={{ textAlign: 'right' }}>Open bills</th>
                  <th style={{ textAlign: 'right' }}>Billed</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map(r => (
                  <tr key={r.supplier_id}>
                    <td style={{ fontWeight: 600 }}>{r.supplier_name}</td>
                    <td style={{ textAlign: 'right' }}>{r.bill_count}</td>
                    <td style={{ textAlign: 'right' }}>{fmtAmount(r.total_billed)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{fmtAmount(r.total_paid)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--warning)' }}>
                      {fmtAmount(r.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
