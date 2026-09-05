import { useState } from 'react'
import { MdEmail } from 'react-icons/md'
import { sendInvoiceEmail } from '../api/inventory'

/**
 * Emails the invoice PDF to a recipient. Shared by the invoice list and the
 * invoice detail page.
 *
 * The send button stays disabled while the address is empty — the backend
 * strips the address before null-checking it, so an empty POST is a 500.
 */
export default function SendInvoiceModal({ invoice, onClose, onSent, template }) {
  const [addr, setAddr]       = useState(invoice?.customer_detail?.email ?? '')
  const [sending, setSending] = useState(false)
  const [msg, setMsg]         = useState(null)

  if (!invoice) return null

  const handleSend = async () => {
    if (!addr.trim()) return
    setSending(true)
    setMsg(null)
    try {
      await sendInvoiceEmail(invoice.id, addr.trim(), template)
      setMsg({ type: 'success', text: 'Email sent successfully!' })
      onSent?.()
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data || 'Failed to send email.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !sending && onClose()}>
      <div className="modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MdEmail style={{ fontSize: 22, color: 'var(--accent)' }} />
          Email Invoice {invoice.invoice_number}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 14 }}>
          Send the PDF of this invoice to a recipient email address.
        </p>
        <input
          type="email"
          className="input"
          placeholder="Recipient email address"
          value={addr}
          onChange={e => setAddr(e.target.value)}
          disabled={sending}
          style={{ width: '100%', marginBottom: 12 }}
        />
        {msg && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10,
            background: msg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {String(msg.text)}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={sending || !addr.trim()}>
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
