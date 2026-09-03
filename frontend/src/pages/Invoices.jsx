import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  MdAdd, MdSearch, MdEdit, MdDelete, MdFilterList,
  MdRefresh, MdPictureAsPdf, MdEmail, MdHistory, MdCallReceived
} from 'react-icons/md'
import {
  getInvoices, deleteInvoice, downloadInvoicePdf,
  getInvoiceVersionHistory
} from '../api/inventory'
import {
  DAY_MS, STATUS_BADGE, fmt, fmtAmount,
  startOfToday, dueDateOf, balanceOf, displayStatus, sortInvoices,
} from '../utils/invoice'
import SendInvoiceModal from '../components/SendInvoiceModal'

// ── component ─────────────────────────────────────────────────────────────────

export default function Invoices() {
  const [invoices, setInvoices]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [deleteId, setDeleteId]       = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [selected, setSelected]       = useState([])   // invoice ids
  const [bulkDelete, setBulkDelete]   = useState(false)

  // email modal state
  const [emailModal, setEmailModal]   = useState(null)   // invoice object

  // version history modal state
  const [historyModal, setHistoryModal] = useState(null)  // invoice object
  const [historyData, setHistoryData]   = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getInvoices()
      const rows = Array.isArray(res.data) ? res.data : res.data.results ?? []
      setInvoices(sortInvoices(rows))
      setSelected([])
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch invoices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  // ── filter ────────────────────────────────────────────────────────────────

  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch =
      inv.invoice_number?.toLowerCase().includes(q) ||
      String(inv.customer_name).toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  // ── payment summary ───────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const today = startOfToday()
    const open = invoices.filter(i => i.status !== 'DRAFT' && balanceOf(i) > 0)

    let outstanding = 0, dueToday = 0, dueIn30 = 0, overdue = 0

    for (const inv of open) {
      const bal = balanceOf(inv)
      outstanding += bal

      const due = dueDateOf(inv)
      if (!due) continue
      const days = Math.round((due - today) / DAY_MS)
      if (days < 0)       overdue  += bal
      else if (days === 0) dueToday += bal
      else if (days <= 30) dueIn30  += bal
    }

    // Average collection time across settled invoices (issue date → last update).
    const settled = invoices.filter(i => i.status === 'PAID' && i.date && i.updated_at)
    const avgDays = settled.length
      ? Math.round(
          settled.reduce((sum, i) =>
            sum + Math.max(0, (new Date(i.updated_at) - new Date(i.date)) / DAY_MS), 0
          ) / settled.length
        )
      : 0

    return { outstanding, dueToday, dueIn30, overdue, avgDays }
  }, [invoices])

  // ── selection ─────────────────────────────────────────────────────────────

  const allSelected = filtered.length > 0 && filtered.every(i => selected.includes(i.id))

  const toggleAll = () => {
    setSelected(allSelected ? [] : filtered.map(i => i.id))
  }

  const toggleOne = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteInvoice(deleteId)
      setInvoices(prev => prev.filter(i => i.id !== deleteId))
      setSelected(prev => prev.filter(x => x !== deleteId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const confirmBulkDelete = async () => {
    setDeleting(true)
    const failed = []
    for (const id of selected) {
      try {
        await deleteInvoice(id)
      } catch {
        failed.push(id)
      }
    }
    setInvoices(prev => prev.filter(i => !selected.includes(i.id) || failed.includes(i.id)))
    setSelected(failed)
    setDeleting(false)
    setBulkDelete(false)
    if (failed.length) alert(`${failed.length} invoice(s) could not be deleted.`)
  }

  // ── PDF download ──────────────────────────────────────────────────────────

  const handleDownloadPdf = async (inv) => {
    try {
      const res = await downloadInvoicePdf(inv.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice_${inv.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Could not download PDF.')
    }
  }

  // ── email send ────────────────────────────────────────────────────────────

  const openHistoryModal = async (inv) => {
    setHistoryModal(inv)
    setHistoryLoading(true)
    try {
      const res = await getInvoiceVersionHistory(inv.id)
      setHistoryData(Array.isArray(res.data) ? res.data : [])
    } catch {
      setHistoryData([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const openEmailModal = (inv) => setEmailModal(inv)

  // ── summary counts ────────────────────────────────────────────────────────

  const paid    = invoices.filter(i => i.status === 'PAID').length
  const partial = invoices.filter(i => i.status === 'PARTIAL').length
  const pending = invoices.filter(i => i.status === 'PENDING').length
  const draft   = invoices.filter(i => i.status === 'DRAFT').length

  // ── render ────────────────────────────────────────────────────────────────

  const summaryCell = (label, value, tone) => (
    <div style={{ flex: '1 1 160px', minWidth: 150 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: tone ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  )

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Invoices</div>
          <div className="page-subtitle">Manage and track your sales invoices</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchInvoices} title="Refresh">
            <MdRefresh />
          </button>
          <Link to="/invoices/new" className="btn btn-primary">
            <MdAdd /> Create Invoice
          </Link>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          color: 'var(--danger)', fontSize: 14, display: 'flex', justifyContent: 'space-between',
        }}>
          ⚠️ {error}
          <button onClick={fetchInvoices} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {/* Payment summary */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '18px 24px', marginBottom: 20,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16,
        }}>
          Payment Summary
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{
            width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', fontSize: 24,
          }}>
            <MdCallReceived />
          </div>
          {summaryCell('Total Outstanding Receivables', fmtAmount(summary.outstanding))}
          {summaryCell('Due Today', fmtAmount(summary.dueToday), 'var(--warning)')}
          {summaryCell('Due Within 30 Days', fmtAmount(summary.dueIn30))}
          {summaryCell('Overdue Invoices', fmtAmount(summary.overdue), summary.overdue > 0 ? 'var(--danger)' : undefined)}
          {summaryCell('Average No. of Days for Getting Paid', `${summary.avgDays} Days`)}
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input
            placeholder="Search by invoice # or customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <MdFilterList style={{ color: 'var(--text-muted)', alignSelf: 'center' }} />
          {['ALL', 'PENDING', 'PARTIAL', 'PAID','DRAFT'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Summary pills / bulk action bar */}
      {selected.length > 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20,
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(99,102,241,0.08)', border: '1px solid var(--accent)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{selected.length} selected</span>
          <button className="btn btn-danger btn-sm" onClick={() => setBulkDelete(true)}>
            <MdDelete /> Delete
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setSelected([])}>Clear</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="info-pill">Total: <strong>{invoices.length}</strong></div>
          <div className="info-pill">Paid: <strong style={{ color: 'var(--success)' }}>{paid}</strong></div>
          <div className="info-pill">Partial: <strong style={{ color: 'var(--warning)' }}>{partial}</strong></div>
          <div className="info-pill">Pending: <strong style={{ color: 'var(--text-muted)' }}>{pending}</strong></div>
          <div className="info-pill">Draft: <strong style={{ color: 'var(--text-muted)' }}>{draft}</strong></div>
        </div>
      )}

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={filtered.length === 0}
                  aria-label="Select all invoices"
                />
              </th>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Customer Name</th>
              <th>Invoice Status</th>
              <th>Due Date</th>
              <th style={{ textAlign: 'right' }}>Invoice Amount</th>
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
                  <div className="empty-state-text">No invoices found</div>
                  <div className="empty-state-sub">
                    {search || statusFilter !== 'ALL' ? 'Try adjusting your search or filter' : 'Create your first invoice'}
                  </div>
                </div>
              </td></tr>
            ) : filtered.map(inv => {
              const st  = displayStatus(inv)
              const due = dueDateOf(inv)
              const bal = balanceOf(inv)
              return (
                <tr key={inv.id} style={selected.includes(inv.id) ? { background: 'rgba(99,102,241,0.06)' } : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(inv.id)}
                      onChange={() => toggleOne(inv.id)}
                      aria-label={`Select invoice ${inv.invoice_number}`}
                    />
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt(inv.date)}</td>
                  <td style={{ fontWeight: 700 }}>
                    <Link to={`/invoices/${inv.id}`} style={{ color: 'var(--accent)' }}>
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td style={{ fontWeight: 500 }}>{inv.customer_name ?? `#${inv.customer}`}</td>
                  <td>
                    <span style={{ color: st.tone, fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }}>
                      {st.label}
                    </span>
                    {inv.status === 'PARTIAL' && (
                      <span className="badge badge-warning" style={{ fontSize: 10, padding: '2px 8px', marginLeft: 8 }}>
                        PARTIAL
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{due ? fmt(due) : '—'}</td>
                  <td style={{ fontWeight: 600, textAlign: 'right' }}>{fmtAmount(inv.total_amount)}</td>
                  <td style={{ textAlign: 'right', color: bal > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {fmtAmount(bal)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link
                        to={`/invoices/${inv.id}/edit`}
                        className="btn btn-outline btn-sm btn-icon"
                        title="Edit"
                      >
                        <MdEdit />
                      </Link>
                      <button
                        className="btn btn-outline btn-sm btn-icon"
                        title="Download PDF"
                        onClick={() => handleDownloadPdf(inv)}
                      >
                        <MdPictureAsPdf />
                      </button>
                      <button
                        className="btn btn-outline btn-sm btn-icon"
                        title="Send Email"
                        onClick={() => openEmailModal(inv)}
                      >
                        <MdEmail />
                      </button>
                      <button
                        className="btn btn-outline btn-sm btn-icon"
                        title="Version History"
                        onClick={() => openHistoryModal(inv)}
                      >
                        <MdHistory />
                      </button>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        title="Delete"
                        onClick={() => setDeleteId(inv.id)}
                      >
                        <MdDelete />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--danger)', fontSize: 24 }}>⚠️</span>
              Delete Invoice
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Are you sure you want to delete this invoice? This action cannot be undone.
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

      {/* Bulk Delete Confirm Modal */}
      {bulkDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setBulkDelete(false)}>
          <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--danger)', fontSize: 24 }}>⚠️</span>
              Delete {selected.length} Invoices
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              This will permanently delete the {selected.length} selected invoices. This action cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setBulkDelete(false)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmBulkDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {emailModal && (
        <SendInvoiceModal invoice={emailModal} onClose={() => setEmailModal(null)} />
      )}

      {/* Version History Modal */}
      {historyModal && (
        <div className="modal-overlay" onClick={() => setHistoryModal(null)}>
          <div className="modal" style={{ width: 560, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MdHistory style={{ fontSize: 22, color: 'var(--accent)' }} />
              Version History — {historyModal.invoice_number}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {historyLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1,2,3].map(i => (
                    <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />
                  ))}
                </div>
              ) : historyData.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No version history found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historyData.map((ver, idx) => (
                    <div
                      key={ver.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderRadius: 10,
                        border: `1px solid ${ver.is_active ? 'var(--accent)' : 'var(--border)'}`,
                        background: ver.is_active ? 'rgba(99,102,241,0.06)' : 'transparent',
                        opacity: ver.is_active ? 1 : 0.6,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                            Version {ver.version}
                          </span>
                          {ver.is_active && (
                            <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 8px' }}>Current</span>
                          )}
                          <span className={`badge ${STATUS_BADGE[ver.status] ?? 'badge-neutral'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                            {ver.status}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {fmt(ver.created_at)} · Total: {fmtAmount(ver.total_amount)} · Paid: {fmtAmount(ver.paid_amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setHistoryModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
