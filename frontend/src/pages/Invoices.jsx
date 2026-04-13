import { useState } from 'react'
import {
  MdAdd, MdSearch, MdEdit, MdDelete, MdFilterList
} from 'react-icons/md'
// import { getInvoices } from '../api/inventory'

export default function Invoices() {
  const [search, setSearch] = useState('')

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Invoices</div>
          <div className="page-subtitle">Manage and track your sales invoices</div>
        </div>
        <button className="btn btn-primary"><MdAdd /> Create Invoice</button>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input placeholder="Search invoices…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm"><MdFilterList /> Filter</button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={6}>
              <div className="empty-state">
                <div className="empty-state-icon">🧾</div>
                <div className="empty-state-text">No invoices found</div>
                <div className="empty-state-sub">Create your first invoice</div>
              </div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
