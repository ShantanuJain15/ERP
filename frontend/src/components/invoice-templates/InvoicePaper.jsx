import { fmt, fmtAmount, dueDateOf, balanceOf, PAYMENT_TERM_DAYS } from '../../utils/invoice'
import { COMPANY } from '../../config/company'
import './invoiceDocument.css'

// ── amount in words (Indian numbering) ───────────────────────────────────────

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const twoDigits = (n) => n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`

const threeDigits = (n) => {
  const h = Math.floor(n / 100), r = n % 100
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ')
}

/** 125300 → "One Lakh Twenty Five Thousand Three Hundred Rupees Only" */
export const amountInWords = (value) => {
  const total = Math.round(Number(value ?? 0))
  if (!total) return 'Zero Rupees Only'

  const parts = []
  const crore = Math.floor(total / 10000000)
  const lakh  = Math.floor((total % 10000000) / 100000)
  const thou  = Math.floor((total % 100000) / 1000)
  const rest  = total % 1000

  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh)  parts.push(`${twoDigits(lakh)} Lakh`)
  if (thou)  parts.push(`${twoDigits(thou)} Thousand`)
  if (rest)  parts.push(threeDigits(rest))

  return `${parts.join(' ')} Rupees Only`
}

// ── document ─────────────────────────────────────────────────────────────────

/**
 * The invoice document itself — a light "paper" surface. Purely presentational:
 * everything comes from props, nothing is fetched here.
 *
 * `variant` picks the visual treatment ('standard' | 'classic'); the data,
 * sections and print behaviour are identical between them.
 */
export default function InvoicePaper({ invoice, company = COMPANY, variant = 'standard' }) {
  const items    = invoice.items ?? []
  const customer = invoice.customer_detail ?? null
  const due      = dueDateOf(invoice)
  const subTotal = items.reduce((s, it) => s + Number(it.total ?? (it.quantity * it.price) ?? 0), 0)
  const balance  = balanceOf(invoice)
  const isDraft  = invoice.status === 'DRAFT'

  const billTo = [
    customer?.address,
    customer?.phone,
    customer?.email,
  ].filter(Boolean).join('\n')

  const sellerAddress = [company.address, company.city, company.pincode].filter(Boolean).join('\n')

  return (
    <div className={`invoice-paper invoice-paper--${variant}`}>
      {isDraft && <div className="invoice-ribbon">DRAFT</div>}

      {/* Header ------------------------------------------------------------ */}
      <div className="invoice-doc-head">
        <div className="invoice-doc-seller">
          <div className="name">{company.name}</div>
          <p style={{ whiteSpace: 'pre-line' }}>{sellerAddress}</p>
          {company.email && <p>{company.email}</p>}
          {company.phone && <p>{company.phone}</p>}
          {company.gstin && <p>GSTIN: {company.gstin}</p>}
        </div>
        <div className="invoice-doc-title">TAX INVOICE</div>
      </div>

      {/* Meta -------------------------------------------------------------- */}
      <table className="invoice-doc-meta">
        <tbody>
          <tr>
            <td className="k">#</td>
            <td className="v">{invoice.invoice_number}</td>
            <td className="k">Invoice Date</td>
            <td className="v">{fmt(invoice.date)}</td>
          </tr>
          <tr>
            <td className="k">Terms</td>
            <td className="v">Net {PAYMENT_TERM_DAYS}</td>
            <td className="k">Due Date (Net {PAYMENT_TERM_DAYS})</td>
            <td className="v">{due ? fmt(due) : '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* Bill To / Ship To -------------------------------------------------- */}
      <div className="invoice-doc-parties">
        <div className="invoice-doc-party">
          <div className="label">Bill To</div>
          <div className="who">{invoice.customer_name ?? customer?.name ?? '—'}</div>
          <div className="addr">{billTo || 'No address on file'}</div>
        </div>
        <div className="invoice-doc-party">
          <div className="label">Ship To</div>
          <div className="addr">{customer?.address || 'Same as billing address'}</div>
        </div>
      </div>

      {/* Line items --------------------------------------------------------- */}
      <table className="invoice-items-table">
        <thead>
          <tr>
            <th className="idx">#</th>
            <th>Item &amp; Description</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--p-muted)' }}>No line items</td></tr>
          ) : items.map((it, i) => (
            <tr key={it.id ?? i}>
              <td className="idx">{i + 1}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{it.product_name ?? `Product #${it.product}`}</div>
                {it.product_sku && <div className="sku">SKU: {it.product_sku}</div>}
                {it.description && <div className="desc">{it.description}</div>}
              </td>
              <td className="num">{it.quantity}</td>
              <td className="num">{fmtAmount(it.price)}</td>
              <td className="num">{fmtAmount(it.total ?? it.quantity * it.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals ------------------------------------------------------------- */}
      <div className="invoice-totals">
        <table>
          <tbody>
            <tr>
              <td className="k">Sub Total</td>
              <td className="v">{fmtAmount(subTotal)}</td>
            </tr>
            <tr className="total">
              <td className="k">Total</td>
              <td className="v">{fmtAmount(invoice.total_amount)}</td>
            </tr>
            <tr>
              <td className="k">Amount Paid</td>
              <td className="v">− {fmtAmount(invoice.paid_amount)}</td>
            </tr>
            <tr className="balance">
              <td className="k">Balance Due</td>
              <td className="v">{fmtAmount(balance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12, marginBottom: 20 }}>
        <strong>Total in words:&nbsp;</strong>
        <em>{amountInWords(invoice.total_amount)}</em>
      </p>

      {/* Footer ------------------------------------------------------------- */}
      <div className="invoice-doc-foot">
        <div>
          <div style={{ fontWeight: 700, color: 'var(--p-ink)', marginBottom: 4 }}>Notes</div>
          <p>Thanks for your business.</p>
          <p style={{ marginTop: 10 }}>
            Payment due within {PAYMENT_TERM_DAYS} days of the invoice date.
          </p>
        </div>
        <div className="invoice-doc-sign">
          <div className="line" />
          Authorized Signature
        </div>
      </div>
    </div>
  )
}
