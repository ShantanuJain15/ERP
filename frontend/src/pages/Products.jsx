import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MdAdd, MdSearch, MdEdit, MdDelete, MdFilterList,
  MdArrowUpward, MdArrowDownward
} from 'react-icons/md'

const MOCK_PRODUCTS = [
  { id: 1, sku: 'PRD-001', name: 'Laptop Dell XPS 15', category: 'Electronics', supplier: 'Dell Inc.', qty: 45, price: 1299.99, status: 'active' },
  { id: 2, sku: 'PRD-002', name: 'Office Chair Pro', category: 'Furniture', supplier: 'Ergonomix Co.', qty: 12, price: 349.00, status: 'active' },
  { id: 3, sku: 'PRD-003', name: 'USB-C Hub 7-Port', category: 'Electronics', supplier: 'Anker Corp.', qty: 150, price: 49.99, status: 'active' },
  { id: 4, sku: 'PRD-004', name: 'Wireless Mouse', category: 'Electronics', supplier: 'Logitech.', qty: 80, price: 59.99, status: 'active' },
  { id: 5, sku: 'PRD-005', name: 'Standing Desk 140cm', category: 'Furniture', supplier: 'FlexiDesk.', qty: 8, price: 599.00, status: 'low_stock' },
  { id: 6, sku: 'PRD-006', name: 'Mechanical Keyboard', category: 'Electronics', supplier: 'Keychron.', qty: 30, price: 149.00, status: 'active' },
  { id: 7, sku: 'PRD-007', name: 'Monitor 27" 4K', category: 'Electronics', supplier: 'LG Display.', qty: 0, price: 699.00, status: 'out_of_stock' },
  { id: 8, sku: 'PRD-008', name: 'Noise Cancelling Buds', category: 'Electronics', supplier: 'Sony Corp.', qty: 55, price: 279.00, status: 'active' },
  { id: 9, sku: 'PRD-009', name: 'Noise Cancelling Buds', category: 'Electronics', supplier: 'Indus.', qty: 2, price: 280.00, status: 'active' },
]

const statusBadge = (s) => {
  if (s === 'active') return <span className="badge badge-success">Active</span>
  if (s === 'low_stock') return <span className="badge badge-warning">Low Stock</span>
  if (s === 'out_of_stock') return <span className="badge badge-danger">Out of Stock</span>
  return <span className="badge badge-neutral">{s}</span>
}

export default function Products() {
  const [products, setProducts] = useState(MOCK_PRODUCTS)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [deleteId, setDeleteId] = useState(null)

  const categories = ['All', ...new Set(MOCK_PRODUCTS.map(p => p.category))]

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = products
    .filter(p =>
      (catFilter === 'All' || p.category === catFilter) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })

  const confirmDelete = () => {
    setProducts(p => p.filter(x => x.id !== deleteId))
    setDeleteId(null)
  }

  const SortIcon = ({ k }) => sortKey === k
    ? (sortDir === 'asc' ? <MdArrowUpward style={{ fontSize: 14 }} /> : <MdArrowDownward style={{ fontSize: 14 }} />)
    : null

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Products</div>
          <div className="page-subtitle">{products.length} total products in inventory</div>
        </div>
        <Link to="/products/new" className="btn btn-primary"><MdAdd /> Add Product</Link>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input placeholder="Search by name or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {categories.map(c => (
            <button
              key={c}
              className={`btn btn-sm ${catFilter === c ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setCatFilter(c)}
            >{c}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm"><MdFilterList /> Filter</button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="info-pill">Total: <strong>{products.length}</strong></div>
        <div className="info-pill">Active: <strong style={{ color: 'var(--success)' }}>{products.filter(p => p.status === 'active').length}</strong></div>
        <div className="info-pill">Low Stock: <strong style={{ color: 'var(--warning)' }}>{products.filter(p => p.status === 'low_stock').length}</strong></div>
        <div className="info-pill">Out of Stock: <strong style={{ color: 'var(--danger)' }}>{products.filter(p => p.status === 'out_of_stock').length}</strong></div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('sku')}>SKU <SortIcon k="sku" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Product Name <SortIcon k="name" /></th>
              <th>Category</th>
              <th>Supplier</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('qty')}>Qty <SortIcon k="qty" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('price')}>Unit Price <SortIcon k="price" /></th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-text">No products found</div>
                  <div className="empty-state-sub">Try adjusting your search or filters</div>
                </div>
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, color: 'var(--accent-light)', fontFamily: 'monospace', fontSize: 13 }}>{p.sku}</td>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td><span className="badge badge-info">{p.category}</span></td>
                <td style={{ color: 'var(--text-secondary)' }}>{p.supplier}</td>
                <td>
                  <span style={{ fontWeight: 700, color: p.qty === 0 ? 'var(--danger)' : p.qty < 10 ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {p.qty}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>${p.price.toFixed(2)}</td>
                <td>{statusBadge(p.status)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/products/${p.id}/edit`} className="btn btn-outline btn-sm btn-icon" title="Edit">
                      <MdEdit />
                    </Link>
                    <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => setDeleteId(p.id)}>
                      <MdDelete />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button className="page-btn">‹</button>
        {[1, 2, 3].map(n => <button key={n} className={`page-btn ${n === 1 ? 'active' : ''}`}>{n}</button>)}
        <button className="page-btn">›</button>
      </div>

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--danger)', fontSize: 24 }}>⚠️</span>
              Delete Product
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
