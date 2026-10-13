import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MdAdd, MdSearch, MdRefresh } from 'react-icons/md'
import { getPaymentsOut } from '../api/inventory'
import { fmt, fmtAmount, rowsOf } from '../utils/purchase'

const METHOD_LABEL = {
  CASH: 'Cash', UPI: 'UPI', NEFT: 'NEFT / RTGS', CHEQUE: 'Cheque', CARD: 'Card',
}

export default function PaymentsOut() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPaymentsOut()
      setPayments(rowsOf(res))
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch payments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const filtered = payments.filter(p => {
    const q = search.toLowerCase()
    return (p.payment_number || '').toLowerCase().includes(q) ||
      (p.supplier_name || '').toLowerCase().includes(q) ||
      (p.reference || '').toLowerCase().includes(q)
  })

  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const unallocated = payments.reduce((s, p) => s + Number(p.unallocated_amount || 0), 0)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Payments Out</div>
          <div className="page-subtitle">What you have paid your suppliers</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchPayments} title="Refresh">
            <MdRefresh />
          </button>
          <Link to="/payments-out/new" className="btn btn-primary"><MdAdd /> Record Payment</Link>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          color: 'var(--danger)', fontSize: 14, display: 'flex', justifyContent: 'space-between',
        }}>
          ⚠️ {error}
          <button onClick={fetchPayments} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input
            placeholder="Search by number, supplier or reference…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="info-pill">Payments: <strong>{payments.length}</strong></div>
        <div className="info-pill">Total paid: <strong>{fmtAmount(total)}</strong></div>
        {unallocated > 0 && (
          <div className="info-pill">
            Unallocated: <strong style={{ color: 'var(--warning)' }}>{fmtAmount(unallocated)}</strong>
          </div>
        )}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Payment</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Settles</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
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
                  <div className="empty-state-icon">💸</div>
                  <div className="empty-state-text">No payments recorded</div>
                  <div className="empty-state-sub">
                    {search ? 'Try adjusting your search' : 'Record a payment to reduce what you owe'}
                  </div>
                </div>
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.payment_number}</td>
                <td>{p.supplier_name || '—'}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt(p.paid_date)}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{METHOD_LABEL[p.method] || p.method}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{p.reference || '—'}</td>
                <td style={{ fontSize: 13 }}>
                  {(p.allocations ?? []).length === 0
                    ? <em style={{ color: 'var(--text-muted)' }}>unallocated</em>
                    : p.allocations.map(a => (
                        <div key={a.id}>{a.bill_number} · {fmtAmount(a.amount)}</div>
                      ))}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAmount(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
