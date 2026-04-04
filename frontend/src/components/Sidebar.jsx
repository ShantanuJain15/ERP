import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  MdDashboard, MdInventory, MdCategory, MdLocalShipping,
  MdSwapVert, MdBarChart, MdLogout, MdSettings,
  MdPeople, MdReceipt, MdPointOfSale, MdExpandMore, MdExpandLess
} from 'react-icons/md'

const navItems = [
  { to: '/dashboard',       icon: <MdDashboard />,      label: 'Dashboard' },
  { to: '/products',        icon: <MdInventory />,       label: 'Products' },
  { to: '/categories',      icon: <MdCategory />,        label: 'Categories' },
  { to: '/suppliers',       icon: <MdLocalShipping />,   label: 'Suppliers' },
  { to: '/stock-movements', icon: <MdSwapVert />,        label: 'Stock Movements' },
  { to: '/reports',         icon: <MdBarChart />,        label: 'Reports' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const [salesOpen, setSalesOpen] = useState(
    location.pathname.startsWith('/customers') || location.pathname.startsWith('/invoices')
  )

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">📦</div>
        <div>
          <div className="logo-text">ERP Suite</div>
          <div className="logo-sub">Inventory Module</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Main Menu</div>
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </NavLink>
        ))}

        {/* <div className="sidebar-section-label" style={{ marginTop: 12 }}>Modules</div> */}
        <button
          className="nav-item"
          style={{ width: '100%', background: 'none', border: 'none', justifyContent: 'flex-start' }}
          onClick={() => setSalesOpen(!salesOpen)}
        >
          <span className="nav-icon"><MdPointOfSale /></span>
          Sales
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            {salesOpen ? <MdExpandLess /> : <MdExpandMore />}
          </span>
        </button>
        
        {salesOpen && (
          <div style={{ marginLeft: 16, marginTop: 2, paddingLeft: 8, borderLeft: '1px solid var(--border)' }}>
            <NavLink to="/customers" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon"><MdPeople /></span>
              Customers
            </NavLink>
            <NavLink to="/invoices" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon"><MdReceipt /></span>
              Invoices
            </NavLink>
          </div>
        )}

        <div className="sidebar-section-label" style={{ marginTop: 12 }}>General</div>
        <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon"><MdSettings /></span>
          Settings
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" style={{ width: '100%', background: 'none', border: 'none' }} onClick={handleLogout}>
          <span className="nav-icon"><MdLogout /></span>
          Logout
        </button>
      </div>
    </aside>
  )
}
