import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'

const monthlyData = [
  { month: 'Oct', in: 320, out: 210, value: 42000 },
  { month: 'Nov', in: 410, out: 280, value: 58000 },
  { month: 'Dec', in: 380, out: 310, value: 51000 },
  { month: 'Jan', in: 450, out: 260, value: 64000 },
  { month: 'Feb', in: 390, out: 340, value: 55000 },
  { month: 'Mar', in: 520, out: 300, value: 72000 },
]

const topProducts = [
  { name: 'Laptop Dell XPS 15',  sold: 145, stock: 45,  value: 188550 },
  { name: 'Monitor 27" 4K',      sold: 98,  stock: 0,   value: 68502 },
  { name: 'Mechanical Keyboard', sold: 87,  stock: 30,  value: 12963 },
  { name: 'Wireless Mouse',      sold: 230, stock: 80,  value: 13797 },
  { name: 'USB-C Hub 7-Port',    sold: 310, stock: 150, value: 15497 },
]

const categoryBreakdown = [
  { name: 'Electronics',  value: 48 },
  { name: 'Furniture',    value: 22 },
  { name: 'Clothing',     value: 18 },
  { name: 'Accessories',  value: 12 },
]
const COLORS = ['#6366f1','#22c55e','#f59e0b','#38bdf8']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  )
}

const KPI = ({ label, value, sub, color }) => (
  <div className="stat-card">
    <div style={{ width: 50, height: 50, borderRadius: 12, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
    </div>
    <div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
)

export default function Reports() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Reports & Analytics</div>
          <div className="page-subtitle">Inventory insights — March 2026</div>
        </div>
        <button className="btn btn-outline">⬇ Export CSV</button>
      </div>

      {/* KPI row */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <KPI label="Total Inventory Value" value="$524K"     sub="All SKUs combined"    color="#6366f1" />
        <KPI label="Items Sold (YTD)"      value="1,870"     sub="Across all categories" color="#22c55e" />
        <KPI label="Stock Turnover Rate"   value="4.2x"      sub="Last 6 months"        color="#f59e0b" />
        <KPI label="Shrinkage Loss"        value="$3,240"    sub="-0.6% of total value"  color="#ef4444" />
      </div>

      {/* Charts row 1 */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>Monthly Stock In vs Out</div>
          <div className="card-sub" style={{ marginBottom: 20 }}>Units received and dispatched per month</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="in"  name="Stock In"  fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="out" name="Stock Out" fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>Inventory Value Trend ($)</div>
          <div className="card-sub" style={{ marginBottom: 20 }}>Total stock value over time</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="value" name="Value ($)" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>Top 5 Products by Sales Volume</div>
          <div className="card-sub" style={{ marginBottom: 20 }}>Units sold YTD</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Product</th><th>Sold</th><th>Stock</th><th>Value ($)</th></tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{p.sold}</td>
                    <td>
                      <span style={{ color: p.stock === 0 ? 'var(--danger)' : p.stock < 10 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                        {p.stock}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>${p.value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>Stock by Category</div>
          <div className="card-sub" style={{ marginBottom: 20 }}>Percentage distribution</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={categoryBreakdown} cx="50%" cy="50%" outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${value}%`} labelLine={false}>
                {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}
