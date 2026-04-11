import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  MdAdd, MdSearch, MdEdit, MdDelete, MdFilterList,
  MdArrowUpward, MdArrowDownward, MdRefresh
} from 'react-icons/md'
import { getProducts, deleteProduct } from '../api/inventory'

// ── helpers ──────────────────────────────────────────────────────────────────

const statusOf = (p) => {
  if (!p.is_active)               return 'inactive'
  if (p.quantity === 0)           return 'out_of_stock'
  if (p.quantity <= p.reorder_level) return 'low_stock'
  return 'active'
}

const statusBadge = (p) => {
  const s = statusOf(p)
  if (s === 'active')      return <span className="badge badge-success">Active</span>
  if (s === 'low_stock')   return <span className="badge badge-warning">Low Stock</span>
  if (s === 'out_of_stock')return <span className="badge badge-danger">Out of Stock</span>
  return <span className="badge badge-neutral">Inactive</span>
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Products() {
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [sortKey, setSortKey]     = useState('name')
  const [sortDir, setSortDir]     = useState('asc')
  const [deleteId, setDeleteId]   = useState(null)
  const [deleting, setDeleting]   = useState(false)

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getProducts()
      // handle both plain array and DRF paginated { results: [] }
      setProducts(Array.isArray(res.data) ? res.data : res.data.results ?? [])
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  // ── filtering & sorting ────────────────────────────────────────────────────

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = products
    .filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' || !isNaN(Number(av)))
        return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av)
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })

  // ── delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteProduct(deleteId)
      setProducts(p => p.filter(x => x.id !== deleteId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  // ── sort icon ──────────────────────────────────────────────────────────────

  const SortIcon = ({ k }) =>
    sortKey === k
      ? (sortDir === 'asc'
          ? <MdArrowUpward  style={{ fontSize: 14, verticalAlign: 'middle' }} />
          : <MdArrowDownward style={{ fontSize: 14, verticalAlign: 'middle' }} />)
      : null

  // ── summary counts ─────────────────────────────────────────────────────────

  const counts = {
    total:        products.length,
    active:       products.filter(p => statusOf(p) === 'active').length,
    low_stock:    products.filter(p => statusOf(p) === 'low_stock').length,
    out_of_stock: products.filter(p => statusOf(p) === 'out_of_stock').length,
    inactive:     products.filter(p => statusOf(p) === 'inactive').length,
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Products</div>
          <div className="page-subtitle">{products.length} total products in inventory</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchProducts} title="Refresh">
            <MdRefresh />
          </button>
          <Link to="/products/new" className="btn btn-primary"><MdAdd /> Add Product</Link>
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
          <button onClick={fetchProducts} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input
            placeholder="Search by name or SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm"><MdFilterList /> Filter</button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="info-pill">Total: <strong>{counts.total}</strong></div>
        <div className="info-pill">Active: <strong style={{ color: 'var(--success)' }}>{counts.active}</strong></div>
        <div className="info-pill">Low Stock: <strong style={{ color: 'var(--warning)' }}>{counts.low_stock}</strong></div>
        <div className="info-pill">Out of Stock: <strong style={{ color: 'var(--danger)' }}>{counts.out_of_stock}</strong></div>
        {counts.inactive > 0 && (
          <div className="info-pill">Inactive: <strong style={{ color: 'var(--text-muted)' }}>{counts.inactive}</strong></div>
        )}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('sku')}>SKU <SortIcon k="sku" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Product Name <SortIcon k="name" /></th>
              <th>Brand</th>
              <th>Supplier</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('quantity')}>Qty <SortIcon k="quantity" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('price')}>Unit Price <SortIcon k="price" /></th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              /* Skeleton rows */
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-text">No products found</div>
                  <div className="empty-state-sub">
                    {search ? 'Try adjusting your search' : 'Add your first product to get started'}
                  </div>
                </div>
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, color: 'var(--accent-light)', fontFamily: 'monospace', fontSize: 13 }}>
                  {p.sku || '—'}
                </td>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{p.brand || '—'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {/* supplier is a FK id from the API — show id or name if nested */}
                  {typeof p.supplier === 'object' ? p.supplier?.name : (p.supplier ?? '—')}
                </td>
                <td>
                  <span style={{
                    fontWeight: 700,
                    color: p.quantity === 0
                      ? 'var(--danger)'
                      : p.quantity <= p.reorder_level
                        ? 'var(--warning)'
                        : 'var(--text-primary)'
                  }}>
                    {p.quantity}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>
                  ${Number(p.price).toFixed(2)}
                </td>
                <td>{statusBadge(p)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/products/${p.id}/edit`} className="btn btn-outline btn-sm btn-icon" title="Edit">
                      <MdEdit />
                    </Link>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      title="Delete"
                      onClick={() => setDeleteId(p.id)}
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
              Delete Product
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Are you sure you want to delete this product? This action cannot be undone.
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
