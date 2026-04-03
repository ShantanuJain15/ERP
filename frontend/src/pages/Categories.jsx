import { useState } from 'react'
import { MdAdd, MdEdit, MdDelete, MdSearch } from 'react-icons/md'

const MOCK_CATEGORIES = [
  { id: 1, name: 'Electronics',     description: 'Electronic devices and accessories', products: 340, created: '2025-01-10' },
  { id: 2, name: 'Furniture',       description: 'Office and home furniture',           products: 180, created: '2025-01-10' },
  { id: 3, name: 'Clothing',        description: 'Apparel and garments',                products: 260, created: '2025-02-04' },
  { id: 4, name: 'Accessories',     description: 'Fashion and tech accessories',        products: 120, created: '2025-02-14' },
  { id: 5, name: 'Food & Beverage', description: 'Consumables and drinks',              products: 90,  created: '2025-03-01' },
  { id: 6, name: 'Raw Materials',   description: 'Manufacturing raw inputs',            products: 60,  created: '2025-03-15' },
]

const COLORS = ['#6366f1','#22c55e','#f59e0b','#38bdf8','#ef4444','#a78bfa']

export default function Categories() {
  const [categories, setCategories] = useState(MOCK_CATEGORIES)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [deleteId, setDeleteId] = useState(null)

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => { setForm({ name: '', description: '' }); setEditing(null); setShowModal(true) }
  const openEdit = c => { setForm({ name: c.name, description: c.description }); setEditing(c.id); setShowModal(true) }

  const handleSave = () => {
    if (!form.name) return
    if (editing) {
      setCategories(prev => prev.map(c => c.id === editing ? { ...c, ...form } : c))
    } else {
      setCategories(prev => [...prev, { id: Date.now(), ...form, products: 0, created: new Date().toISOString().split('T')[0] }])
    }
    setShowModal(false)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Categories</div>
          <div className="page-subtitle">{categories.length} product categories</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><MdAdd /> Add Category</button>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 320 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input placeholder="Search categories…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid-3">
        {filtered.map((cat, i) => (
          <div key={cat.id} className="card" style={{ borderTop: `3px solid ${COLORS[i % COLORS.length]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="card-title">{cat.name}</div>
                <div className="card-sub" style={{ marginTop: 4, marginBottom: 16 }}>{cat.description}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(cat)} title="Edit"><MdEdit /></button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(cat.id)} title="Delete"><MdDelete /></button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: COLORS[i % COLORS.length] }}>{cat.products}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Products</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Created {cat.created}</div>
            </div>
          </div>
        ))}

        {/* Add Card */}
        <div
          className="card"
          onClick={openAdd}
          style={{ border: '2px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, cursor: 'pointer', minHeight: 140, transition: 'border-color 0.2s' }}
          onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
        >
          <div style={{ fontSize: 32, color: 'var(--text-muted)' }}>+</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>Add Category</div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editing ? 'Edit Category' : 'New Category'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Category name" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Short description…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">⚠️ Delete Category</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Deleting this category may affect associated products. Continue?</p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { setCategories(p => p.filter(c => c.id !== deleteId)); setDeleteId(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
