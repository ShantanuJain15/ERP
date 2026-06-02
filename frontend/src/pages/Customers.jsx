import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  MdAdd, MdSearch, MdEdit, MdDelete,
  MdArrowUpward, MdArrowDownward, MdRefresh
} from 'react-icons/md'
import { getCustomers, deleteCustomer } from '../api/inventory'

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [sortKey, setSortKey]     = useState('name')
  const [sortDir, setSortDir]     = useState('asc')
  const [deleteId, setDeleteId]   = useState(null)
  const [deleting, setDeleting]   = useState(false)

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getCustomers()
      setCustomers(Array.isArray(res.data) ? res.data : res.data.results ?? [])
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch customers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // ── sort ──────────────────────────────────────────────────────────────────

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = customers
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
    )
    .sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })

  // ── delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteCustomer(deleteId)
      setCustomers(p => p.filter(x => x.id !== deleteId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const SortIcon = ({ k }) =>
    sortKey === k
      ? (sortDir === 'asc'
          ? <MdArrowUpward  style={{ fontSize: 13, verticalAlign: 'middle' }} />
          : <MdArrowDownward style={{ fontSize: 13, verticalAlign: 'middle' }} />)
      : null

  // ── counts ────────────────────────────────────────────────────────────────

  const active   = customers.filter(c => c.is_active).length
  const inactive = customers.length - active

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Customers</div>
          <div className="page-subtitle">{customers.length} total customers</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchCustomers} title="Refresh">
            <MdRefresh />
          </button>
          <Link to="/customers/new" className="btn btn-primary"><MdAdd /> Add Customer</Link>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          color: 'var(--danger)', fontSize: 14, display: 'flex', justifyContent: 'space-between'
        }}>
          ⚠️ {error}
          <button onClick={fetchCustomers} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="info-pill">Total: <strong>{customers.length}</strong></div>
        <div className="info-pill">Active: <strong style={{ color: 'var(--success)' }}>{active}</strong></div>
        {inactive > 0 && (
          <div className="info-pill">Inactive: <strong style={{ color: 'var(--text-muted)' }}>{inactive}</strong></div>
        )}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                Name <SortIcon k="name" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('email')}>
                Email <SortIcon k="email" />
              </th>
              <th>Phone</th>
              <th>Address</th>
              <th>Status</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>
                Created <SortIcon k="created_at" />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('updated_at')}>
                Updated <SortIcon k="updated_at" />
              </th>
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
                  <div className="empty-state-icon">👥</div>
                  <div className="empty-state-text">No customers found</div>
                  <div className="empty-state-sub">
                    {search ? 'Try adjusting your search' : 'Add your first customer to get started'}
                  </div>
                </div>
              </td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>#{c.id}</td>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                <td style={{ color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.address || '—'}
                </td>
                <td>
                  {c.is_active
                    ? <span className="badge badge-success">Active</span>
                    : <span className="badge badge-neutral">Inactive</span>}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt(c.created_at)}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{fmt(c.updated_at)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/customers/${c.id}/edit`} className="btn btn-outline btn-sm btn-icon" title="Edit">
                      <MdEdit />
                    </Link>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      title="Delete"
                      onClick={() => setDeleteId(c.id)}
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
              Delete Customer
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Are you sure you want to delete this customer? This will also affect any linked invoices.
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
    </>
  )
}
