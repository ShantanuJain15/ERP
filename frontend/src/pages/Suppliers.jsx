import { useState } from 'react'
import { MdAdd, MdEdit, MdDelete, MdSearch, MdPhone, MdEmail, MdLocationOn } from 'react-icons/md'

const MOCK_SUPPLIERS = [
  { id: 1, name: 'Dell Inc.',      contact: 'John Doe',    email: 'orders@dell.com',       phone: '+1 800 624 9897', address: 'Round Rock, TX, USA',   products: 45, status: 'active' },
  { id: 2, name: 'Ergonomix Co.',  contact: 'Sara Smith',  email: 'supply@ergonomix.com',  phone: '+44 20 7946 0958', address: 'London, UK',            products: 12, status: 'active' },
  { id: 3, name: 'Anker Corp.',    contact: 'Wei Liu',     email: 'b2b@anker.com',         phone: '+86 755 2645 8812', address: 'Shenzhen, China',      products: 30, status: 'active' },
  { id: 4, name: 'Logitech.',      contact: 'Marc Blanc',  email: 'trade@logitech.com',    phone: '+41 21 863 5111', address: 'Lausanne, Switzerland',  products: 22, status: 'active' },
  { id: 5, name: 'FlexiDesk.',     contact: 'Amir Khan',   email: 'sales@flexidesk.com',   phone: '+49 30 4747 2100', address: 'Berlin, Germany',      products: 8, status: 'inactive' },
  { id: 6, name: 'Sony Corp.',     contact: 'Kenji Tanaka',email: 'b2b@sony.co.jp',        phone: '+81 3 5448 2111', address: 'Tokyo, Japan',           products: 18, status: 'active' },
]

const EMPTY_FORM = { name: '', contact: '', email: '', phone: '', address: '', status: 'active' }

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState(MOCK_SUPPLIERS)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState(null)

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contact.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd  = () => { setForm(EMPTY_FORM); setEditing(null); setShowModal(true) }
  const openEdit = s  => { setForm({ name: s.name, contact: s.contact, email: s.email, phone: s.phone, address: s.address, status: s.status }); setEditing(s.id); setShowModal(true) }

  const handleSave = () => {
    if (!form.name) return
    if (editing) setSuppliers(p => p.map(s => s.id === editing ? { ...s, ...form } : s))
    else setSuppliers(p => [...p, { id: Date.now(), ...form, products: 0 }])
    setShowModal(false)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Suppliers</div>
          <div className="page-subtitle">{suppliers.length} registered suppliers</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><MdAdd /> Add Supplier</button>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div className="info-pill">Active: <strong style={{ color: 'var(--success)' }}>{suppliers.filter(s => s.status === 'active').length}</strong></div>
          <div className="info-pill">Inactive: <strong style={{ color: 'var(--danger)' }}>{suppliers.filter(s => s.status === 'inactive').length}</strong></div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Supplier</th><th>Contact Person</th><th>Email</th><th>Phone</th><th>Address</th><th>Products</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <div className="empty-state-icon">🏭</div>
                  <div className="empty-state-text">No suppliers found</div>
                </div>
              </td></tr>
            ) : filtered.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{s.contact}</td>
                <td>
                  <a href={`mailto:${s.email}`} style={{ color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 13 }}>
                    <MdEmail /> {s.email}
                  </a>
                </td>
                <td style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                  <MdPhone /> {s.phone}
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MdLocationOn /> {s.address}
                </td>
                <td style={{ fontWeight: 700 }}>{s.products}</td>
                <td>
                  <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {s.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(s)}><MdEdit /></button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(s.id)}><MdDelete /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editing ? 'Edit Supplier' : 'New Supplier'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Company Name *', key: 'name',    placeholder: 'Supplier company name' },
                { label: 'Contact Person', key: 'contact', placeholder: 'Primary contact name' },
                { label: 'Email',          key: 'email',   placeholder: 'contact@company.com', type: 'email' },
                { label: 'Phone',          key: 'phone',   placeholder: '+1 000 000 0000' },
              ].map(f => (
                <div key={f.key} className="form-group">
                  <label>{f.label}</label>
                  <input className="input" type={f.type || 'text'} placeholder={f.placeholder}
                    value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Address</label>
                <input className="input" placeholder="City, Country" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">⚠️ Delete Supplier</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>This will remove all supplier data. This action cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { setSuppliers(p => p.filter(s => s.id !== deleteId)); setDeleteId(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
