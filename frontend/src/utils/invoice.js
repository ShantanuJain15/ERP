// Shared invoice helpers used by the invoice list, the detail page and the
// document templates — keep them here so every surface agrees on formatting,
// ordering and what "overdue" means.

/** Payment terms used to derive a due date — the Invoice model has no due_date column. */
export const PAYMENT_TERM_DAYS = 30

export const DAY_MS = 24 * 60 * 60 * 1000

export const fmt = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export const fmtAmount = (n) =>
  Number(n ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

export const STATUS_BADGE = {
  PAID:    'badge-success',
  PARTIAL: 'badge-warning',
  PENDING: 'badge-danger',
  DRAFT:   'badge-neutral',
}

/** Midnight of today, so day-diffs are calendar days rather than fractions. */
export const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const dueDateOf = (inv) => {
  if (!inv?.date) return null
  const d = new Date(inv.date)
  d.setDate(d.getDate() + PAYMENT_TERM_DAYS)
  d.setHours(0, 0, 0, 0)
  return d
}

export const balanceOf = (inv) => Number(inv?.total_amount ?? 0) - Number(inv?.paid_amount ?? 0)

/**
 * Derives the Zoho-style display status: PAID / DRAFT stay as-is, anything with an
 * outstanding balance becomes "OVERDUE BY n DAYS" or "DUE IN n DAYS".
 */
export const displayStatus = (inv) => {
  if (inv.status === 'PAID')  return { label: 'PAID',  tone: 'var(--success)' }
  if (inv.status === 'DRAFT') return { label: 'DRAFT', tone: 'var(--text-muted)' }

  const due = dueDateOf(inv)
  if (!due) return { label: inv.status, tone: 'var(--text-secondary)' }

  const days = Math.round((due - startOfToday()) / DAY_MS)
  if (days < 0)   return { label: `OVERDUE BY ${Math.abs(days)} DAYS`, tone: 'var(--danger)' }
  if (days === 0) return { label: 'DUE TODAY', tone: 'var(--warning)' }
  return { label: `DUE IN ${days} DAYS`, tone: 'var(--text-secondary)' }
}

/** Newest first. The API order is not guaranteed, so every list sorts locally. */
export const sortInvoices = (list) =>
  [...list].sort((a, b) => {
    const diff = new Date(b.date ?? 0) - new Date(a.date ?? 0)
    if (diff) return diff
    return String(b.invoice_number ?? '').localeCompare(String(a.invoice_number ?? ''))
  })
