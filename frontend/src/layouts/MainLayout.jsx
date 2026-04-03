import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

export default function MainLayout() {
  return (
    <>
      <Sidebar />
      <Topbar />
      <main className="main-content">
        <Outlet />
      </main>
    </>
  )
}
