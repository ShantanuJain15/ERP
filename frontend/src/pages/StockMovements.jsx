import { useState } from 'react'
import { MdAdd, MdSearch, MdArrowUpward, MdArrowDownward, MdSwapVert } from 'react-icons/md'

const PRODUCTS = ['Laptop Dell XPS 15', 'Office Chair Pro', 'USB-C Hub 7-Port', 'Wireless Mouse', 'Standing Desk 140cm', 'Mechanical Keyboard', 'Monitor 27" 4K']
const MOCK_MOVEMENTS = [
  { id: 'SM-001', product: 'Laptop Dell XPS 15',   type: 'IN',  qty: 50,  ref: 'PO-2026-041', note: 'Purchase Order',    date: '2026-03-24 09:15', user: 'Admin' },
  { id: 'SM-002', product: 'Office Chair Pro',      type: 'OUT', qty: 12,  ref: 'SO-2026-089', note: 'Sales Order',       date: '2026-03-23 14:30', user: 'Admin' },
  { id: 'SM-003', product: 'USB-C Hub 7-Port',      type: 'IN',  qty: 100, ref: 'PO-2026-040', note: 'Restock',           date: '2026-03-23 11:00', user: 'Admin' },
  { id: 'SM-004', product: 'Wireless Mouse',        type: 'OUT', qty: 30,  ref: 'SO-2026-088', note: 'Customer Order',    date: '2026-03-22 16:45', user: 'Admin' },
  { id: 'SM-005', product: 'Standing Desk 140cm',   type: 'IN',  qty: 8,   ref: 'PO-2026-039', note: 'Emergency Restock', date: '2026-03-21 10:00', user: 'Admin' },
  { id: 'SM-006', product: 'Mechanical Keyboard',   type: 'ADJ', qty: -5,  ref: 'ADJ-001',     note: 'Damaged goods',    date: '2026-03-20 13:30', user: 'Admin' },
  { id: 'SM-007', product: 'Monitor 27" 4K',        type: 'OUT', qty: 4,   ref: 'SO-2026-087', note: 'Internal use',     date: '2026-03-19 15:00', user: 'Admin' },
]

const typeConfig = {
  IN:  { label: 'Stock In',     badge: 'badge-success', icon: <MdArrowUpward style={{ fontSize: 13 }} /> },
  OUT: { label: 'Stock Out',    badge: 'badge-warning',  icon: <MdArrowDownward style={{ fontSize: 13 }} /> },
  ADJ: { label: 'Adjustment',   badge: 'badge-info',     icon: <MdSwapVert style={{ fontSize: 13 }} /> },
}

const EMPTY_FORM = { product: '', type: 'IN', qty: '', ref: '', note: '' }

export default function StockMovements() {
  const [movements, setMovements] = useState(MOCK_MOVEMENTS)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const filtered = movements.filter(m =>
    (typeFilter === 'All' || m.type === typeFilter) &&
    (m.product.toLowerCase().includes(search.toLowerCase()) ||
     m.ref.toLowerCase().includes(search.toLowerCase()))
  )

  const handleSave = () => {
    if (!form.product || !form.qty) return
    const newM = {
      id: `SM-${String(movements.length + 1).padStart(3, '0')}`,
      ...form,
      qty: Number(form.qty),
      date: new Date().toLocaleString('sv-SE').replace('T', ' ').slice(0, 16),
      user: 'Admin',
    }
    setMovements(p => [newM, ...p])
    setShowModal(false)
    setForm(EMPTY_FORM)
  }

  const totalIn  = movements.filter(m => m.type === 'IN').reduce((a, m) => a + m.qty, 0)
  const totalOut = movements.filter(m => m.type === 'OUT').reduce((a, m) => a + m.qty, 0)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Stock Movements</div>
          <div className="page-subtitle">Track all inventory in/out transactions</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><MdAdd /> Record Movement</button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div className="stat-card" style={{ flex: 1, padding: '16px 20px' }}>
          <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', width: 42, height: 42, fontSize: 18 }}><MdArrowUpward /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{totalIn}</div>
            <div className="stat-label">Total Stock In</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, padding: '16px 20px' }}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)', width: 42, height: 42, fontSize: 18 }}><MdArrowDownward /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)' }}>{totalOut}</div>
            <div className="stat-label">Total Stock Out</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, padding: '16px 20px' }}>
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', width: 42, height: 42, fontSize: 18 }}><MdSwapVert /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-light)' }}>{movements.length}</div>
            <div className="stat-label">Total Transactions</div>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input placeholder="Search by product or reference…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['All', 'IN', 'OUT', 'ADJ'].map(t => (
            <button key={t} className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTypeFilter(t)}>{t === 'All' ? 'All' : typeConfig[t]?.label}</button>
          ))}
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>ID</th><th>Product</th><th>Type</th><th>Qty</th><th>Reference</th><th>Note</th><th>Date</th><th>By</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-text">No movements found</div>
                </div>
              </td></tr>
            ) : filtered.map(m => {
              const cfg = typeConfig[m.type] || {}
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent-light)', fontFamily: 'monospace', fontSize: 13 }}>{m.id}</td>
                  <td style={{ fontWeight: 500 }}>{m.product}</td>
                  <td><span className={`badge ${cfg.badge}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{cfg.icon}{cfg.label}</span></td>
                  <td style={{ fontWeight: 700, color: m.type === 'IN' ? 'var(--success)' : m.type === 'OUT' ? 'var(--warning)' : 'var(--info)' }}>
                    {m.type === 'IN' ? '+' : m.type === 'OUT' ? '-' : '±'}{Math.abs(m.qty)}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent-light)' }}>{m.ref}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.note}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.date}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.user}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Record Movement Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Record Stock Movement</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Product *</label>
                <select className="select" value={form.product} onChange={e => setForm(p => ({ ...p, product: e.target.value }))}>
                  <option value="">Select product…</option>
                  {PRODUCTS.map(pr => <option key={pr}>{pr}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Movement Type *</label>
                  <select className="select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="IN">Stock In</option>
                    <option value="OUT">Stock Out</option>
                    <option value="ADJ">Adjustment</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input className="input" type="number" min="1" placeholder="0" value={form.qty} onChange={e => setForm(p => ({ ...p, qty: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Reference No.</label>
                <input className="input" placeholder="e.g. PO-2026-001" value={form.ref} onChange={e => setForm(p => ({ ...p, ref: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea className="input" rows={2} placeholder="Reason or notes…" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Movement</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
