import { useState, useEffect } from 'react'
import { MdAdd, MdEdit, MdDelete, MdSearch, MdPhone, MdEmail, MdLocationOn, MdRefresh } from 'react-icons/md'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../api/inventory'

const EMPTY_FORM = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  is_active: true,
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [apiError, setApiError]   = useState(null)
  const [formError, setFormError] = useState(null)

  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [deleteId, setDeleteId]   = useState(null)

  // ── Fetch suppliers from API ──────────────────────────────────────────────
  const fetchSuppliers = async () => {
    setLoading(true)
    setApiError(null)
    try {
      const res = await getSuppliers()
      const data = Array.isArray(res.data) ? res.data : res.data.results ?? []
      setSuppliers(data)
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Failed to connect to backend server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = suppliers.filter(s => {
    const term = search.toLowerCase()
    const name = (s.name || '').toLowerCase()
    const contact = (s.contact_person || s.contact || '').toLowerCase()
    const email = (s.email || '').toLowerCase()
    return name.includes(term) || contact.includes(term) || email.includes(term)
  })

  const activeCount = suppliers.filter(s => s.is_active !== false).length
  const inactiveCount = suppliers.filter(s => s.is_active === false).length

  // ── Modal Actions ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (s) => {
    setForm({
      name:           s.name           || '',
      contact_person: s.contact_person || s.contact || '',
      email:          s.email          || '',
      phone:          s.phone          || '',
      address:        s.address        || '',
      is_active:      s.is_active !== undefined ? s.is_active : true,
    })
    setEditing(s.id)
    setFormError(null)
    setShowModal(true)
  }

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Company Name is required.')
      return
    }
    setSaving(true)
    setFormError(null)

    const payload = {
      name:           form.name.trim(),
      contact_person: form.contact_person.trim(),
      email:          form.email.trim(),
      phone:          form.phone.trim(),
      address:        form.address.trim(),
      is_active:      Boolean(form.is_active),
    }

    try {
      if (editing) {
        await updateSupplier(editing, payload)
      } else {
        await createSupplier(payload)
      }
      setShowModal(false)
      fetchSuppliers()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ')
        setFormError(msg || 'Failed to save supplier.')
      } else {
        setFormError('Failed to save supplier. Please check network connection.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteSupplier(deleteId)
      setDeleteId(null)
      fetchSuppliers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete supplier.')
    } finally {
      setDeleting(false)
    }
  }

  const supplierToDelete = suppliers.find(s => s.id === deleteId)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Suppliers</div>
          <div className="page-subtitle">{suppliers.length} registered suppliers</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={fetchSuppliers} title="Refresh">
            <MdRefresh />
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <MdAdd /> Add Supplier
          </button>
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 20,
          color: 'var(--danger)', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>⚠️ {apiError}</span>
          <button className="btn btn-outline btn-sm" onClick={fetchSuppliers}>Retry</button>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input
            placeholder="Search suppliers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div className="info-pill">
            Active: <strong style={{ color: 'var(--success)' }}>{activeCount}</strong>
          </div>
          <div className="info-pill">
            Inactive: <strong style={{ color: 'var(--danger)' }}>{inactiveCount}</strong>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Supplier Name</th>
              <th>Contact Person</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Products</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Loading suppliers from server…</div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">🏭</div>
                    <div className="empty-state-text">No suppliers found</div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(s => {
                const isAct = s.is_active !== false
                const contactPerson = s.contact_person || s.contact || '—'
                const prodCount = s.products_count ?? s.products ?? 0
                const initial = (s.name || 'S').charAt(0).toUpperCase()

                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 6,
                          background: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 13, flexShrink: 0
                        }}>
                          {initial}
                        </div>
                        <span>{s.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{contactPerson}</td>
                    <td>
                      {s.email ? (
                        <a
                          href={`mailto:${s.email}`}
                          style={{ color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 13 }}
                        >
                          <MdEmail /> {s.email}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {s.phone ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MdPhone /> {s.phone}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {s.address ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MdLocationOn /> {s.address}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>{prodCount}</td>
                    <td>
                      <span className={`badge ${isAct ? 'badge-success' : 'badge-danger'}`}>
                        {isAct ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(s)} title="Edit">
                          <MdEdit />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(s.id)} title="Delete">
                          <MdDelete />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editing ? `Edit "${form.name}"` : 'New Supplier'}</div>

            {formError && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                color: 'var(--danger)', fontSize: 13,
              }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Company Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    className="input"
                    placeholder="Supplier company name"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Contact Person</label>
                  <input
                    className="input"
                    placeholder="Primary contact name"
                    value={form.contact_person}
                    onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="contact@company.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input
                    className="input"
                    placeholder="+1 000 000 0000"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Address</label>
                  <input
                    className="input"
                    placeholder="City, Country"
                    value={form.address}
                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="select"
                    value={form.is_active ? 'active' : 'inactive'}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 20 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : (editing ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">⚠️ Delete Supplier</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Are you sure you want to delete supplier <strong>"{supplierToDelete?.name || 'this supplier'}"</strong>? This action cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
