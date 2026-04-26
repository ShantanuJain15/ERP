import { useState, useEffect, useCallback } from 'react'
import {
  MdAdd, MdSearch, MdEdit, MdDelete, MdFilterList,
  MdRefresh, MdPictureAsPdf, MdEmail
} from 'react-icons/md'
import {
  getInvoices, deleteInvoice, downloadInvoicePdf, sendInvoiceEmail
} from '../api/inventory'

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const fmtAmount = (n) =>
  Number(n ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

const STATUS_BADGE = {
  PAID:    'badge-success',
  PARTIAL: 'badge-warning',
  PENDING: 'badge-neutral',
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Invoices() {
  const [invoices, setInvoices]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [deleteId, setDeleteId]       = useState(null)
  const [deleting, setDeleting]       = useState(false)

  // email modal state
  const [emailModal, setEmailModal]   = useState(null)   // invoice object
  const [emailAddr, setEmailAddr]     = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailMsg, setEmailMsg]       = useState(null)

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getInvoices()
      setInvoices(Array.isArray(res.data) ? res.data : res.data.results ?? [])
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
      String(inv.customer).toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  // ── delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteInvoice(deleteId)
      setInvoices(prev => prev.filter(i => i.id !== deleteId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
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

  const openEmailModal = (inv) => {
    setEmailModal(inv)
    setEmailAddr('')
    setEmailMsg(null)
  }

  const handleSendEmail = async () => {
    if (!emailAddr.trim()) return
    setEmailSending(true)
    setEmailMsg(null)
    try {
      await sendInvoiceEmail(emailModal.id, emailAddr.trim())
      setEmailMsg({ type: 'success', text: 'Email sent successfully!' })
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.response?.data || 'Failed to send email.' })
    } finally {
      setEmailSending(false)
    }
  }

  // ── summary counts ────────────────────────────────────────────────────────

  const paid    = invoices.filter(i => i.status === 'PAID').length
  const partial = invoices.filter(i => i.status === 'PARTIAL').length
  const pending = invoices.filter(i => i.status === 'PENDING').length

  // ── render ────────────────────────────────────────────────────────────────

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
          <button className="btn btn-primary">
            <MdAdd /> Create Invoice
          </button>
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
          {['ALL', 'PENDING', 'PARTIAL', 'PAID'].map(s => (
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

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="info-pill">Total: <strong>{invoices.length}</strong></div>
        <div className="info-pill">Paid: <strong style={{ color: 'var(--success)' }}>{paid}</strong></div>
        <div className="info-pill">Partial: <strong style={{ color: 'var(--warning)' }}>{partial}</strong></div>
        <div className="info-pill">Pending: <strong style={{ color: 'var(--text-muted)' }}>{pending}</strong></div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Status</th>
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
                  <div className="empty-state-icon">🧾</div>
                  <div className="empty-state-text">No invoices found</div>
                  <div className="empty-state-sub">
                    {search || statusFilter !== 'ALL' ? 'Try adjusting your search or filter' : 'Create your first invoice'}
                  </div>
                </div>
              </td></tr>
            ) : filtered.map(inv => (
              <tr key={inv.id}>
                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{inv.invoice_number}</td>
                <td style={{ fontWeight: 500 }}>{inv.customer_name ?? `#${inv.customer}`}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt(inv.date)}</td>
                <td style={{ fontWeight: 600 }}>{fmtAmount(inv.total_amount)}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{fmtAmount(inv.paid_amount)}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[inv.status] ?? 'badge-neutral'}`}>
                    {inv.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-outline btn-sm btn-icon"
                      title="Edit"
                    >
                      <MdEdit />
                    </button>
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
                      className="btn btn-danger btn-sm btn-icon"
                      title="Delete"
                      onClick={() => setDeleteId(inv.id)}
                    >
                      <MdDelete />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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

      {/* Send Email Modal */}
      {emailModal && (
        <div className="modal-overlay" onClick={() => !emailSending && setEmailModal(null)}>
          <div className="modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MdEmail style={{ fontSize: 22, color: 'var(--accent)' }} />
              Email Invoice {emailModal.invoice_number}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 14 }}>
              Send the PDF of this invoice to a recipient email address.
            </p>
            <input
              type="email"
              className="form-input"
              placeholder="Recipient email address"
              value={emailAddr}
              onChange={e => setEmailAddr(e.target.value)}
              disabled={emailSending}
              style={{ width: '100%', marginBottom: 12 }}
            />
            {emailMsg && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10,
                background: emailMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: emailMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${emailMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {String(emailMsg.text)}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEmailModal(null)} disabled={emailSending}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSendEmail} disabled={emailSending || !emailAddr.trim()}>
                {emailSending ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
