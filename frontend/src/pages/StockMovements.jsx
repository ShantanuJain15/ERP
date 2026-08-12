import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MdAdd,
  MdArrowDownward,
  MdArrowUpward,
  MdRefresh,
  MdSearch,
  MdSwapVert,
} from 'react-icons/md'
import {
  createStockMovement,
  getProducts,
  getStockMovementStats,
  getStockMovements,
  getWarehouses,
} from '../api/inventory'

const MOVEMENT_TYPES = [
  { value: 'IN', label: 'Stock In' },
  { value: 'OUT', label: 'Stock Out' },
  { value: 'ADJ_UP', label: 'Adjustment Increase' },
  { value: 'ADJ_DOWN', label: 'Adjustment Decrease' },
  { value: 'RETURN', label: 'Customer Return' },
  { value: 'DAMAGE', label: 'Damage / Write-off' },
]

const typeConfig = {
  IN: { label: 'Stock In', badge: 'badge-success', icon: <MdArrowUpward style={{ fontSize: 13 }} /> },
  OUT: { label: 'Stock Out', badge: 'badge-warning', icon: <MdArrowDownward style={{ fontSize: 13 }} /> },
  ADJ_UP: { label: 'Adjustment Increase', badge: 'badge-success', icon: <MdSwapVert style={{ fontSize: 13 }} /> },
  ADJ_DOWN: { label: 'Adjustment Decrease', badge: 'badge-info', icon: <MdSwapVert style={{ fontSize: 13 }} /> },
  RETURN: { label: 'Customer Return', badge: 'badge-success', icon: <MdArrowUpward style={{ fontSize: 13 }} /> },
  DAMAGE: { label: 'Damage / Write-off', badge: 'badge-danger', icon: <MdArrowDownward style={{ fontSize: 13 }} /> },
}

const EMPTY_FORM = {
  product: '',
  warehouse: '',
  type: 'IN',
  qty: '',
  reference_type: 'MANUAL',
  reference_number: '',
  notes: '',
}

const asArray = (data) => Array.isArray(data) ? data : data?.results ?? []

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('sv-SE').replace('T', ' ').slice(0, 16)
}

const movementQty = (movement) => Number(movement.quantity_change ?? movement.signed_quantity ?? 0)

export default function StockMovements() {
  const [searchParams] = useSearchParams()
  const productParam = searchParams.get('product') || ''
  const [movements, setMovements] = useState([])
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [stats, setStats] = useState({ total_stock_in: 0, total_stock_out: 0, total_movements: 0 })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (typeFilter !== 'All') params.movement_type = typeFilter
      if (productParam) params.product = productParam
      if (search.trim()) params.search = search.trim()

      const [movementRes, productRes, warehouseRes, statsRes] = await Promise.all([
        getStockMovements(params),
        getProducts(),
        getWarehouses({ is_active: true }),
        getStockMovementStats(params),
      ])

      setMovements(asArray(movementRes.data))
      setProducts(asArray(productRes.data))
      setWarehouses(asArray(warehouseRes.data))
      setStats(statsRes.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load stock movements')
    } finally {
      setLoading(false)
    }
  }, [productParam, search, typeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => movements, [movements])

  const handleSave = async () => {
    if (!form.product || !form.warehouse || !form.qty) return

    setSaving(true)
    setError(null)
    try {
      await createStockMovement({
        product: Number(form.product),
        warehouse: Number(form.warehouse),
        movement_type: form.type,
        quantity: Number(form.qty),
        reference_type: form.reference_type,
        reference_number: form.reference_number,
        notes: form.notes,
      })
      setShowModal(false)
      setForm(EMPTY_FORM)
      await fetchData()
    } catch (err) {
      const data = err.response?.data
      const message = typeof data === 'string'
        ? data
        : data?.detail || data?.non_field_errors?.[0] || Object.values(data || {})?.flat?.()?.[0]
      setError(message || err.message || 'Failed to save stock movement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Stock Movements</div>
          <div className="page-subtitle">Track all inventory in/out transactions</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchData} title="Refresh">
            <MdRefresh />
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <MdAdd /> Record Movement
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          color: 'var(--danger)', fontSize: 14, display: 'flex', justifyContent: 'space-between'
        }}>
          {error}
          <button onClick={fetchData} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 180, padding: '16px 20px' }}>
          <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', width: 42, height: 42, fontSize: 18 }}><MdArrowUpward /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{stats.total_stock_in ?? 0}</div>
            <div className="stat-label">Total Stock In</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 180, padding: '16px 20px' }}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)', width: 42, height: 42, fontSize: 18 }}><MdArrowDownward /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)' }}>{stats.total_stock_out ?? 0}</div>
            <div className="stat-label">Total Stock Out</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 180, padding: '16px 20px' }}>
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', width: 42, height: 42, fontSize: 18 }}><MdSwapVert /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-light)' }}>{stats.total_movements ?? stats.total_transactions ?? movements.length}</div>
            <div className="stat-label">Total Movements</div>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input placeholder="Search by product, SKU, warehouse, or reference..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All', ...MOVEMENT_TYPES.map(t => t.value)].map(t => (
            <button key={t} className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTypeFilter(t)}>
              {t === 'All' ? 'All' : typeConfig[t]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>ID</th><th>Product</th><th>Warehouse</th><th>Type</th><th>Qty</th><th>Reference</th><th>Note</th><th>Date</th><th>By</th></tr>
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
                  <div className="empty-state-icon">SM</div>
                  <div className="empty-state-text">No movements found</div>
                  <div className="empty-state-sub">{search ? 'Try adjusting your search' : 'Record your first stock movement'}</div>
                </div>
              </td></tr>
            ) : filtered.map(m => {
              const movementType = m.movement_type || m.txn_type
              const cfg = typeConfig[movementType] || {}
              const qty = movementQty(m)
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent-light)', fontFamily: 'monospace', fontSize: 13 }}>{m.movement_number || `SM-${String(m.id).padStart(3, '0')}`}</td>
                  <td style={{ fontWeight: 500 }}>{m.product_name || m.product}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{m.warehouse_name || m.warehouse}</td>
                  <td><span className={`badge ${cfg.badge || 'badge-neutral'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{cfg.icon}{cfg.label || movementType}</span></td>
                  <td style={{ fontWeight: 700, color: qty >= 0 ? 'var(--success)' : 'var(--warning)' }}>
                    {qty >= 0 ? '+' : '-'}{Math.abs(qty)}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent-light)' }}>{m.reference_number || '-'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.notes || '-'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(m.created_at)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.performed_by || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Record Stock Movement</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Product *</label>
                <select className="select" value={form.product} onChange={e => setForm(p => ({ ...p, product: e.target.value }))}>
                  <option value="">Select product...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>{product.name} {product.sku ? `(${product.sku})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Warehouse *</label>
                <select className="select" value={form.warehouse} onChange={e => setForm(p => ({ ...p, warehouse: e.target.value }))}>
                  <option value="">Select warehouse...</option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Movement Type *</label>
                  <select className="select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {MOVEMENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input className="input" type="number" min="1" placeholder="0" value={form.qty} onChange={e => setForm(p => ({ ...p, qty: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Reference Type</label>
                  <select className="select" value={form.reference_type} onChange={e => setForm(p => ({ ...p, reference_type: e.target.value }))}>
                    <option value="MANUAL">Manual</option>
                    <option value="PO">Purchase Order</option>
                    <option value="SO">Sales Order</option>
                    <option value="INVOICE">Invoice</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Reference No.</label>
                  <input className="input" placeholder="e.g. PO-2026-001" value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="input" rows={2} placeholder="Reason or notes..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.product || !form.warehouse || !form.qty}>
                {saving ? 'Saving...' : 'Save Movement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
