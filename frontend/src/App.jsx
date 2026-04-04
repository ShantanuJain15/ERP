import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import Categories from './pages/Categories'
import Suppliers from './pages/Suppliers'
import StockMovements from './pages/StockMovements'
import Reports from './pages/Reports'
import Customers from './pages/Customers'
import CustomerForm from './pages/CustomerForm'
import Invoices from './pages/Invoices'

const isLoggedIn = () => !!localStorage.getItem('access_token')

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"        element={<Dashboard />} />
          <Route path="products"         element={<Products />} />
          <Route path="products/new"     element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="categories"       element={<Categories />} />
          <Route path="suppliers"        element={<Suppliers />} />
          <Route path="stock-movements"  element={<StockMovements />} />
          <Route path="reports"          element={<Reports />} />
          <Route path="customers"        element={<Customers />} />
          <Route path="customers/new"    element={<CustomerForm />} />
          <Route path="customers/:id/edit" element={<CustomerForm />} />
          <Route path="invoices"         element={<Invoices />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
