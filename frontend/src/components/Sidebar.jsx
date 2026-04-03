import { NavLink, useNavigate } from 'react-router-dom'
import {
  MdDashboard, MdInventory, MdCategory, MdLocalShipping,
  MdSwapVert, MdBarChart, MdLogout, MdSettings
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
