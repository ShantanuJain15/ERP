import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MdExpandMore, MdExpandLess } from 'react-icons/md'

/**
 * A collapsible group of nav links.
 *
 * Extracted when Purchase was added: two hand-written dropdowns meant two
 * copies of the same markup and two ad-hoc pieces of open/close state.
 *
 * Starts open when the current route is one of its children, so navigating
 * straight to /bills doesn't leave you looking at a collapsed group.
 */
export default function NavGroup({ label, icon, items }) {
  const location = useLocation()
  const containsActiveRoute = items.some(item => location.pathname.startsWith(item.to))
  const [open, setOpen] = useState(containsActiveRoute)

  return (
    <>
      <button
        className="nav-item"
        style={{ width: '100%', background: 'none', border: 'none', justifyContent: 'flex-start' }}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="nav-icon">{icon}</span>
        {label}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          {open ? <MdExpandLess /> : <MdExpandMore />}
        </span>
      </button>

      {open && (
        <div style={{ marginLeft: 16, marginTop: 2, paddingLeft: 8, borderLeft: '1px solid var(--border)' }}>
          {items.map(({ to, icon: itemIcon, label: itemLabel }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{itemIcon}</span>
              {itemLabel}
            </NavLink>
          ))}
        </div>
      )}
    </>
  )
}
