import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MdAdd,
  MdDelete,
  MdEdit,
  MdLocationOn,
  MdPhone,
  MdRefresh,
  MdSearch,
  MdWarehouse,
} from 'react-icons/md'
import {
  createWarehouse,
  deleteWarehouse,
  getWarehouses,
  updateWarehouse,
} from '../api/inventory'

const WAREHOUSE_TYPES = [
  { value: 'MAIN', label: 'Main' },
  { value: 'BRANCH', label: 'Branch' },
  { value: 'STORE', label: 'Store' },
  { value: 'VIRTUAL', label: 'Virtual' },
]

const EMPTY_FORM = {
  code: '',
  name: '',
  warehouse_type: 'MAIN',
  address: '',
  city: '',
  state: '',
  country: '',
  phone: '',
  is_default: false,
  is_active: true,
}

const asArray = (data) => Array.isArray(data) ? data : data?.results ?? []

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const warehouseTypeLabel = (value) =>
  WAREHOUSE_TYPES.find(type => type.value === value)?.label || value || '-'

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const fetchWarehouses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getWarehouses()
      setWarehouses(asArray(res.data))
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load warehouses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWarehouses() }, [fetchWarehouses])

  const counts = useMemo(() => ({
    total: warehouses.length,
    active: warehouses.filter(item => item.is_active).length,
    inactive: warehouses.filter(item => !item.is_active).length,
    defaults: warehouses.filter(item => item.is_default).length,
  }), [warehouses])

  const filteredWarehouses = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return warehouses

    return warehouses.filter(warehouse => [
      warehouse.code,
      warehouse.name,
      warehouse.warehouse_type,
      warehouse.address,
      warehouse.city,
      warehouse.state,
      warehouse.country,
      warehouse.phone,
    ].some(value => String(value || '').toLowerCase().includes(term)))
  }, [search, warehouses])

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setShowModal(true)
    setError(null)
  }

  const openEdit = (warehouse) => {
    setForm({
      code: warehouse.code || '',
      name: warehouse.name || '',
      warehouse_type: warehouse.warehouse_type || 'MAIN',
      address: warehouse.address || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      country: warehouse.country || '',
      phone: warehouse.phone || '',
      is_default: Boolean(warehouse.is_default),
      is_active: Boolean(warehouse.is_active),
    })
    setEditing(warehouse.id)
    setShowModal(true)
    setError(null)
  }

  const errorMessage = (err, fallback) => {
    const data = err.response?.data
    if (!data) return err.message || fallback
    if (typeof data === 'string') return data
    if (data.detail) return data.detail
    const first = Object.entries(data)[0]
    if (!first) return fallback
    const [field, value] = first
    const text = Array.isArray(value) ? value[0] : value
    return `${field}: ${text}`
  }

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) return

    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        phone: form.phone.trim(),
      }

      if (editing) {
        await updateWarehouse(editing, payload)
      } else {
        await createWarehouse(payload)
      }

      setShowModal(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      await fetchWarehouses()
    } catch (err) {
      setError(errorMessage(err, 'Failed to save warehouse'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    setError(null)
    try {
      await deleteWarehouse(deleteId)
      setWarehouses(items => items.filter(item => item.id !== deleteId))
      setDeleteId(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete warehouse'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Warehouses</div>
          <div className="page-subtitle">Create and manage warehouse master records</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchWarehouses} title="Refresh">
            <MdRefresh />
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <MdAdd /> Add Warehouse
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 20,
          color: 'var(--danger)',
          fontSize: 14,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <span>{error}</span>
          <button onClick={fetchWarehouses} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 360 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input placeholder="Search code, name, city, or address..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="info-pill">Total: <strong>{counts.total}</strong></div>
          <div className="info-pill">Active: <strong style={{ color: 'var(--success)' }}>{counts.active}</strong></div>
          <div className="info-pill">Default: <strong style={{ color: 'var(--accent-light)' }}>{counts.defaults}</strong></div>
          {counts.inactive > 0 && <div className="info-pill">Inactive: <strong style={{ color: 'var(--text-muted)' }}>{counts.inactive}</strong></div>}
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Warehouse</th>
              <th>Type</th>
              <th>Location</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : filteredWarehouses.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <div className="empty-state-icon">WH</div>
                  <div className="empty-state-text">No warehouses found</div>
                  <div className="empty-state-sub">{search ? 'Try adjusting your search' : 'Add your first warehouse'}</div>
                </div>
              </td></tr>
            ) : filteredWarehouses.map(warehouse => {
              const location = [warehouse.city, warehouse.state, warehouse.country].filter(Boolean).join(', ')
              return (
                <tr key={warehouse.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent-light)', fontWeight: 700 }}>
                    {warehouse.code}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <MdWarehouse style={{ color: 'var(--text-muted)', fontSize: 18 }} />
                      {warehouse.name}
                    </div>
                    {warehouse.address && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {warehouse.address}
                      </div>
                    )}
                  </td>
                  <td>{warehouseTypeLabel(warehouse.warehouse_type)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MdLocationOn /> {location || '-'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {warehouse.phone ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MdPhone /> {warehouse.phone}</span> : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {warehouse.is_active
                        ? <span className="badge badge-success">Active</span>
                        : <span className="badge badge-neutral">Inactive</span>}
                      {warehouse.is_default && <span className="badge badge-info">Default</span>}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(warehouse.updated_at || warehouse.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(warehouse)} title="Edit">
                        <MdEdit />
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(warehouse.id)} title="Delete">
                        <MdDelete />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal" style={{ width: 720, maxWidth: 'calc(100vw - 32px)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editing ? 'Edit Warehouse' : 'New Warehouse'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Code *</label>
                <input className="input" placeholder="MAIN-WH" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="form-group">
                <label>Name *</label>
                <input className="input" placeholder="Main Warehouse" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="select" value={form.warehouse_type} onChange={e => setForm(p => ({ ...p, warehouse_type: e.target.value }))}>
                  {WAREHOUSE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="input" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Address</label>
                <input className="input" placeholder="Street address" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>City</label>
                <input className="input" placeholder="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>State</label>
                <input className="input" placeholder="State" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input className="input" placeholder="Country" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Flags</label>
                <div style={{ display: 'flex', gap: 14, minHeight: 40, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 14 }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                    Active
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 14 }}>
                    <input type="checkbox" checked={form.is_default} onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))} />
                    Default
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.code.trim() || !form.name.trim()}>
                {saving ? 'Saving...' : editing ? 'Update Warehouse' : 'Create Warehouse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Delete Warehouse</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              This will delete the warehouse if it is not referenced by stock, purchase orders, or sales orders.
            </p>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
