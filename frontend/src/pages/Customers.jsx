import { useState } from 'react'
import {
  MdAdd, MdSearch, MdEdit, MdDelete
} from 'react-icons/md'

export default function Customers() {
  const [search, setSearch] = useState('')

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
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={6}>
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-text">No customers found</div>
                <div className="empty-state-sub">Start by adding a new customer</div>
              </div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
