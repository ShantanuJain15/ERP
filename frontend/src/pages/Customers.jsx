import { useState } from 'react'
import {
  MdAdd, MdSearch, MdEdit, MdDelete
} from 'react-icons/md'

const MOCK_CUSTOMERS = [
  { id: 1, name: 'Acme Corp', email: 'contact@acme.com', phone: '+1 555-0198', status: 'active', created_at: '2026-03-10', updated_at: '2026-04-01' },
  { id: 2, name: 'Globex Inc', email: 'hello@globex.inc', phone: '+1 555-0200', status: 'active', created_at: '2026-03-12', updated_at: '2026-03-28' },
  { id: 3, name: 'Soylent Corp', email: 'sales@soylent.co', phone: '+1 555-0377', status: 'inactive', created_at: '2026-02-15', updated_at: '2026-03-15' },
]

export default function Customers() {
  const [customers, setCustomers] = useState(MOCK_CUSTOMERS)
  const [search, setSearch] = useState('')

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const statusBadge = (s) => (
    <span className={`badge badge-${s === 'active' ? 'success' : 'neutral'}`}>
      {s === 'active' ? 'Active' : 'Inactive'}
    </span>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Customers</div>
          <div className="page-subtitle">Manage your customer database</div>
        </div>
        <button className="btn btn-primary"><MdAdd /> Add Customer</button>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <div className="empty-state-text">No customers found</div>
                  <div className="empty-state-sub">Start by adding a new customer</div>
                </div>
              </td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>#{c.id}</td>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.email}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.phone}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.created_at}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.updated_at}</td>
                <td>{statusBadge(c.status)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm btn-icon" title="Edit">
                      <MdEdit />
                    </button>
                    <button className="btn btn-danger btn-sm btn-icon" title="Delete">
                      <MdDelete />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
