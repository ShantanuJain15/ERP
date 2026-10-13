// Shared purchase-side helpers, mirroring utils/invoice.js so both modules
// agree on formatting and on what "overdue" means.
//
// One deliberate difference: a Bill carries a real `due_date` column, derived
// server-side from the supplier's payment terms. So unlike the invoice helpers,
// nothing here hardcodes 30 days — read the field.

import { DAY_MS, fmt, fmtAmount, startOfToday } from './invoice'

export { fmt, fmtAmount }

export const PO_STATUS_BADGE = {
  DRAFT:              'badge-neutral',
  SUBMITTED:          'badge-info',
  PARTIALLY_RECEIVED: 'badge-warning',
  RECEIVED:           'badge-success',
  CLOSED:             'badge-neutral',
  CANCELLED:          'badge-danger',
}

export const GRN_STATUS_BADGE = {
  DRAFT:     'badge-neutral',
  RECEIVED:  'badge-success',
  CANCELLED: 'badge-danger',
}

export const BILL_STATUS_BADGE = {
  DRAFT:          'badge-neutral',
  RECEIVED:       'badge-warning',
  PARTIALLY_PAID: 'badge-info',
  PAID:           'badge-success',
  CANCELLED:      'badge-danger',
}

/** Turn SNAKE_CASE statuses into something readable in a table cell. */
export const statusLabel = (status) =>
  String(status ?? '').replace(/_/g, ' ')

export const balanceOf = (bill) =>
  Number(bill?.total_amount ?? 0) - Number(bill?.paid_amount ?? 0)

/**
 * Display status for a bill: PAID / DRAFT / CANCELLED stay as-is; anything
 * still owing becomes "OVERDUE BY n DAYS" or "DUE IN n DAYS".
 */
export const displayBillStatus = (bill) => {
  if (bill.status === 'PAID')      return { label: 'PAID',      tone: 'var(--success)' }
  if (bill.status === 'DRAFT')     return { label: 'DRAFT',     tone: 'var(--text-muted)' }
  if (bill.status === 'CANCELLED') return { label: 'CANCELLED', tone: 'var(--danger)' }

  if (!bill.due_date) return { label: statusLabel(bill.status), tone: 'var(--text-secondary)' }

  const due = new Date(bill.due_date)
  due.setHours(0, 0, 0, 0)

  const days = Math.round((due - startOfToday()) / DAY_MS)
  if (days < 0)   return { label: `OVERDUE BY ${Math.abs(days)} DAYS`, tone: 'var(--danger)' }
  if (days === 0) return { label: 'DUE TODAY', tone: 'var(--warning)' }
  return { label: `DUE IN ${days} DAYS`, tone: 'var(--text-secondary)' }
}

/** Unwrap a DRF list response, which may or may not be paginated. */
export const rowsOf = (res) =>
  Array.isArray(res.data) ? res.data : res.data?.results ?? []

/**
 * Flatten a DRF error body into a { field: message } map.
 * Mirrors the unwrapping in CustomerForm/InvoiceForm.
 */
export const unwrapErrors = (data) => {
  const errors = {}
  if (!data || typeof data !== 'object') return { _: 'Something went wrong.' }

  Object.entries(data).forEach(([key, val]) => {
    errors[key] = Array.isArray(val) ? val[0] : String(val)
  })
  return errors
}
