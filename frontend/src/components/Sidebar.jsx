import { useNavigate } from 'react-router-dom'
import { NavLink } from 'react-router-dom'
import {
  MdDashboard, MdInventory, MdCategory, MdLocalShipping,
  MdSwapVert, MdBarChart, MdLogout, MdSettings, MdWarehouse,
  MdPeople, MdReceipt, MdPointOfSale, MdShoppingCart,
  MdAssignment, MdCallReceived, MdReceiptLong, MdPayments,
} from 'react-icons/md'
import NavGroup from './NavGroup'

const navItems = [
  { to: '/dashboard',       icon: <MdDashboard />,      label: 'Dashboard' },
  { to: '/products',        icon: <MdInventory />,       label: 'Products' },
  { to: '/categories',      icon: <MdCategory />,        label: 'Categories' },
  { to: '/warehouses',      icon: <MdWarehouse />,       label: 'Warehouses' },
  { to: '/warehouse-stock', icon: <MdWarehouse />,       label: 'Warehouse Stock' },
  { to: '/stock-movements', icon: <MdSwapVert />,        label: 'Stock Movements' },
  { to: '/reports',         icon: <MdBarChart />,        label: 'Reports' },
]

const salesItems = [
  { to: '/customers', icon: <MdPeople />,  label: 'Customers' },
  { to: '/invoices',  icon: <MdReceipt />, label: 'Invoices' },
]

// Order follows the procure-to-pay lifecycle: who we buy from, what we ordered,
// what arrived, what we were billed, what we paid.
const purchaseItems = [
  { to: '/suppliers',         icon: <MdLocalShipping />, label: 'Suppliers' },
  { to: '/purchase-orders',   icon: <MdAssignment />,    label: 'Purchase Orders' },
  { to: '/purchase-receives', icon: <MdCallReceived />,  label: 'Purchase Receives' },
  { to: '/bills',             icon: <MdReceiptLong />,   label: 'Bills' },
  { to: '/payments-out',      icon: <MdPayments />,      label: 'Payments Out' },
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

        <NavGroup label="Sales" icon={<MdPointOfSale />} items={salesItems} />
        <NavGroup label="Purchase" icon={<MdShoppingCart />} items={purchaseItems} />

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
