import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  MdEdit, MdEmail, MdPrint, MdPictureAsPdf, MdHistory, MdDelete,
  MdArrowBack, MdSearch, MdSend, MdCheckCircle, MdAutoAwesome, MdMoreHoriz,
} from 'react-icons/md'
import {
  getInvoices, getInvoice, patchInvoice, deleteInvoice,
  downloadInvoicePdf, getInvoiceVersionHistory,
} from '../api/inventory'
import {
  fmt, fmtAmount, displayStatus, sortInvoices, STATUS_BADGE,
} from '../utils/invoice'
import StandardTemplate from '../components/invoice-templates/StandardTemplate'
import ClassicTemplate from '../components/invoice-templates/ClassicTemplate'
import SendInvoiceModal from '../components/SendInvoiceModal'
import '../components/invoice-templates/invoiceDocument.css'

const TEMPLATES = {
  standard: { label: 'Standard', Component: StandardTemplate },
  classic:  { label: 'Classic',  Component: ClassicTemplate },
}
const TEMPLATE_KEY = 'invoiceTemplate'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [list, setList]         = useState([])
  const [invoice, setInvoice]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [railSearch, setRailSearch] = useState('')

  // A single flag gates every mutation — two concurrent PATCHes would fork the
  // version chain and deduct stock twice.
  const [busy, setBusy]         = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [template, setTemplate] = useState(
    () => localStorage.getItem(TEMPLATE_KEY) ?? 'standard'
  )

  const [emailOpen, setEmailOpen]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [historyOpen, setHistoryOpen]     = useState(false)
  const [historyData, setHistoryData]     = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const activeCardRef = useRef(null)

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    const res = await getInvoices()
    const rows = Array.isArray(res.data) ? res.data : res.data.results ?? []
    setList(sortInvoices(rows))
    return sortInvoices(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([fetchList(), getInvoice(id)])
      .then(([, res]) => { if (!cancelled) setInvoice(res.data) })
      .catch(err => {
        if (cancelled) return
        if (err.response?.status === 404) {
          setError('This invoice version was superseded or removed.')
          setTimeout(() => navigate('/invoices'), 1800)
        } else {
          setError(err.response?.data?.detail || err.message || 'Failed to load invoice')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [id, fetchList, navigate])

  // Bring a deep-linked invoice into view in the rail.
  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ block: 'nearest' })
  }, [id, list.length])

  useEffect(() => { localStorage.setItem(TEMPLATE_KEY, template) }, [template])

  // ── actions ───────────────────────────────────────────────────────────────

  const handleMarkAsSent = async () => {
    setBusy(true)
    try {
      // The update is versioned server-side: the response is a NEW row with a
      // new primary key, so the old id 404s from here on.
      const res = await patchInvoice(invoice.id, { status: 'PENDING' })
      setInvoice(res.data)
      await fetchList()
      navigate(`/invoices/${res.data.id}`, { replace: true })
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not mark this invoice as sent.')
    } finally {
      setBusy(false)
    }
  }

  const handleDownloadPdf = async () => {
    setBusy(true)
    try {
      const res = await downloadInvoicePdf(invoice.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice_${invoice.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Could not download PDF.')
    } finally {
      setBusy(false)
    }
  }

  const openHistory = async () => {
    setMenuOpen(false)
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const res = await getInvoiceVersionHistory(invoice.id)
      setHistoryData(Array.isArray(res.data) ? res.data : [])
    } catch {
      setHistoryData([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    // Pick the neighbour to land on before the row disappears from the rail.
    const idx  = list.findIndex(i => String(i.id) === String(id))
    const next = list[idx + 1] ?? list[idx - 1] ?? null
    try {
      await deleteInvoice(invoice.id)
      await fetchList()
      navigate(next ? `/invoices/${next.id}` : '/invoices', { replace: true })
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed. Please try again.')
    } finally {
      setBusy(false)
      setConfirmDel(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const q = railSearch.toLowerCase()
  const railRows = list.filter(inv =>
    !q ||
    inv.invoice_number?.toLowerCase().includes(q) ||
    String(inv.customer_name).toLowerCase().includes(q)
  )

  const Template = TEMPLATES[template]?.Component ?? StandardTemplate

  return (
    <div className="invoice-detail-page">
      {/* ── Left rail ───────────────────────────────────────────────────── */}
      <aside className="invoice-rail">
        <div className="invoice-rail-head">
          <Link to="/invoices" className="btn btn-outline btn-sm btn-icon" title="All invoices">
            <MdArrowBack />
          </Link>
          <div className="search-box" style={{ flex: 1 }}>
            <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
            <input
              placeholder="Search invoices…"
              value={railSearch}
              onChange={e => setRailSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="invoice-rail-list">
          {loading && list.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: '14px 16px' }}>
                <div className="skeleton" style={{ height: 40, borderRadius: 6 }} />
              </div>
            ))
          ) : railRows.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <div className="empty-state-text">No invoices</div>
            </div>
          ) : railRows.map(inv => {
            const st = displayStatus(inv)
            const isActive = String(inv.id) === String(id)
            return (
              <button
                key={inv.id}
                ref={isActive ? activeCardRef : null}
                className={`invoice-rail-card${isActive ? ' active' : ''}`}
                onClick={() => navigate(`/invoices/${inv.id}`)}
              >
                <div className="invoice-rail-top">
                  <span className="invoice-rail-name">{inv.customer_name ?? `#${inv.customer}`}</span>
                  <span className="invoice-rail-amt">{fmtAmount(inv.total_amount)}</span>
                </div>
                <div className="invoice-rail-meta">
                  <span className="num">{inv.invoice_number}</span> · {fmt(inv.date)}
                </div>
                <div className="invoice-rail-status" style={{ color: st.tone }}>{st.label}</div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Document pane ───────────────────────────────────────────────── */}
      <section className="invoice-doc-pane">
        <div className="invoice-toolbar">
          <Link
            to={invoice ? `/invoices/${invoice.id}/edit` : '#'}
            className="btn btn-outline btn-sm"
            style={!invoice || busy ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
          >
            <MdEdit /> Edit
          </Link>
          <button className="btn btn-outline btn-sm" disabled={!invoice || busy} onClick={() => setEmailOpen(true)}>
            <MdEmail /> Send
          </button>
          <button className="btn btn-outline btn-sm" disabled={!invoice || busy} onClick={() => window.print()}>
            <MdPrint /> Print
          </button>
          <button className="btn btn-outline btn-sm" disabled={!invoice || busy} onClick={handleDownloadPdf}>
            <MdPictureAsPdf /> PDF
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-outline btn-sm btn-icon"
              disabled={!invoice || busy}
              onClick={() => setMenuOpen(o => !o)}
              title="More"
            >
              <MdMoreHoriz />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: '110%', left: 0, zIndex: 20, minWidth: 190,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow)', padding: 6,
              }}>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                  onClick={openHistory}
                >
                  <MdHistory /> Version History
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', color: 'var(--danger)' }}
                  onClick={() => { setMenuOpen(false); setConfirmDel(true) }}
                >
                  <MdDelete /> Delete
                </button>
              </div>
            )}
          </div>

          <div className="spacer" />

          <div className="invoice-tpl-switch">
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                className={`btn btn-sm ${template === key ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTemplate(key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* DRAFT next-step banner */}
        {invoice?.status === 'DRAFT' && (
          <div className="invoice-next-banner">
            <MdAutoAwesome style={{ color: 'var(--accent-light)', fontSize: 20 }} />
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>WHAT'S NEXT?</strong>{' '}
              Send this invoice to your customer or mark it as sent.
            </span>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setEmailOpen(true)}>
              <MdSend /> Send Invoice
            </button>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={handleMarkAsSent}>
              <MdCheckCircle /> {busy ? 'Working…' : 'Mark As Sent'}
            </button>
          </div>
        )}

        <div className="invoice-doc-scroll">
          {error ? (
            <div style={{
              maxWidth: 820, margin: '0 auto', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
              padding: '14px 18px', color: 'var(--danger)', fontSize: 14,
            }}>
              ⚠️ {error}
            </div>
          ) : loading || !invoice ? (
            <div className="skeleton" style={{ maxWidth: 820, margin: '0 auto', height: 700, borderRadius: 6 }} />
          ) : (
            <Template invoice={invoice} />
          )}
        </div>
      </section>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {emailOpen && (
        <SendInvoiceModal invoice={invoice} onClose={() => setEmailOpen(false)} />
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={() => !busy && setConfirmDel(false)}>
          <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--danger)', fontSize: 24 }}>⚠️</span>
              Delete Invoice
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Delete {invoice?.invoice_number}? This cannot be undone, and stock is not returned
              to inventory.
            </p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setConfirmDel(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="modal-overlay" onClick={() => setHistoryOpen(false)}>
          <div
            className="modal"
            style={{ width: 560, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MdHistory style={{ fontSize: 22, color: 'var(--accent)' }} />
              Version History — {invoice?.invoice_number}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {historyLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />)}
                </div>
              ) : historyData.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No version history found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historyData.map(ver => (
                    <div
                      key={ver.id}
                      style={{
                        padding: '12px 16px', borderRadius: 10,
                        border: `1px solid ${ver.is_active ? 'var(--accent)' : 'var(--border)'}`,
                        background: ver.is_active ? 'rgba(99,102,241,0.06)' : 'transparent',
                        opacity: ver.is_active ? 1 : 0.6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Version {ver.version}</span>
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
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setHistoryOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
