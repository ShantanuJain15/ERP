import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { MdInventory, MdCategory, MdLocalShipping, MdTrendingUp, MdAdd, MdArrowForward } from 'react-icons/md'

// Mock data (replace with API calls when backend is ready)
const mockStats = [
  { label: 'Total Products', value: '1,248', change: '+12%', dir: 'up', icon: <MdInventory />, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  { label: 'Categories',     value: '34',    change: '+2',   dir: 'up', icon: <MdCategory />,  color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  { label: 'Suppliers',      value: '89',    change: '0',    dir: 'neutral', icon: <MdLocalShipping />, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { label: 'Low Stock Items',value: '17',    change: '+5',   dir: 'down', icon: <MdTrendingUp />, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
]

const stockTrend = [
  { month: 'Oct', in: 320, out: 210 },
  { month: 'Nov', in: 410, out: 280 },
  { month: 'Dec', in: 380, out: 310 },
  { month: 'Jan', in: 450, out: 260 },
  { month: 'Feb', in: 390, out: 340 },
  { month: 'Mar', in: 520, out: 300 },
]

const categoryData = [
  { name: 'Electronics',  value: 340 },
  { name: 'Furniture',    value: 180 },
  { name: 'Clothing',     value: 260 },
  { name: 'Accessories',  value: 120 },
  { name: 'Others',       value: 90  },
]
const PIE_COLORS = ['#6366f1','#38bdf8','#22c55e','#f59e0b','#ef4444']

const recentMovements = [
  { id: 'SM-001', product: 'Laptop Dell XPS 15', type: 'IN',  qty: 50,  date: '2026-03-24', status: 'completed' },
  { id: 'SM-002', product: 'Office Chair Pro',   type: 'OUT', qty: 12,  date: '2026-03-23', status: 'completed' },
  { id: 'SM-003', product: 'USB-C Hub 7-Port',   type: 'IN',  qty: 100, date: '2026-03-23', status: 'pending' },
  { id: 'SM-004', product: 'Wireless Mouse',     type: 'OUT', qty: 30,  date: '2026-03-22', status: 'completed' },
  { id: 'SM-005', product: 'Standing Desk',      type: 'IN',  qty: 8,   date: '2026-03-21', status: 'completed' },
]

export default function Dashboard() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => setLoading(false), 600)
  }, [])

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Welcome back, Admin! Here's what's happening today.</div>
        </div>
        <Link to="/products/new" className="btn btn-primary">
          <MdAdd /> Add Product
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {mockStats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div className="stat-value">{loading ? <span className="skeleton" style={{ width: 60, height: 28, display: 'block' }} /> : s.value}</div>
              <div className="stat-label">{s.label}</div>
              <div className={`stat-change ${s.dir}`}>{s.dir === 'up' ? '▲' : s.dir === 'down' ? '▼' : '—'} {s.change} this month</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        {/* Stock Trend */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div><div className="card-title">Stock Movement Trend</div><div className="card-sub">Last 6 months — in vs out</div></div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stockTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
              <Area type="monotone" dataKey="in"  stroke="#6366f1" fill="url(#gIn)"  strokeWidth={2} name="Stock In" />
              <Area type="monotone" dataKey="out" stroke="#22c55e" fill="url(#gOut)" strokeWidth={2} name="Stock Out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="card">
          <div style={{ marginBottom: 20 }}>
            <div className="card-title">Products by Category</div>
            <div className="card-sub">Current stock distribution</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Movements */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div className="card-title">Recent Stock Movements</div>
            <div className="card-sub">Latest inventory transactions</div>
          </div>
          <Link to="/stock-movements" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            View All <MdArrowForward />
          </Link>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Product</th><th>Type</th><th>Qty</th><th>Date</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentMovements.map(m => (
                <tr key={m.id}>
                  <td style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{m.id}</td>
                  <td>{m.product}</td>
                  <td>
                    <span className={`badge ${m.type === 'IN' ? 'badge-success' : 'badge-warning'}`}>
                      {m.type === 'IN' ? '▲' : '▼'} {m.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{m.qty}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{m.date}</td>
                  <td>
                    <span className={`badge ${m.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
