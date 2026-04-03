import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MdSearch, MdNotifications } from 'react-icons/md'

const pageTitles = {
  '/dashboard':       { title: 'Dashboard',       sub: 'Overview of your inventory' },
  '/products':        { title: 'Products',         sub: 'Manage your product catalog' },
  '/categories':      { title: 'Categories',       sub: 'Organize product categories' },
  '/suppliers':       { title: 'Suppliers',        sub: 'Manage supplier information' },
  '/stock-movements': { title: 'Stock Movements',  sub: 'Track inventory in/out' },
  '/reports':         { title: 'Reports',          sub: 'Analytics and insights' },
}

export default function Topbar() {
  const { pathname } = useLocation()
  const [search, setSearch] = useState('')

  const base = '/' + pathname.split('/')[1]
  const { title = 'ERP', sub = '' } = pageTitles[base] || {}

  const user = { name: 'Admin', initials: 'AD' }

  return (
    <header className="topbar">
      <div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>

      <div className="topbar-right">
        <div className="topbar-search">
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0 }} />
          <input
            placeholder="Search products, suppliers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="notification-btn">
          <MdNotifications />
          <span className="notif-dot" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" title={user.name}>{user.initials}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Administrator</div>
          </div>
        </div>
      </div>
    </header>
  )
}
