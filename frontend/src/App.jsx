import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import Categories from './pages/Categories'
import Suppliers from './pages/Suppliers'
import Warehouses from './pages/Warehouses'
import StockMovements from './pages/StockMovements'
import WarehouseStock from './pages/WarehouseStock'
import Reports from './pages/Reports'
import Customers from './pages/Customers'
import CustomerForm from './pages/CustomerForm'
import Invoices from './pages/Invoices'
import InvoiceForm from './pages/InvoiceForm'
import InvoiceDetail from './pages/InvoiceDetail'
import PurchaseOrders from './pages/PurchaseOrders'
import PurchaseOrderForm from './pages/PurchaseOrderForm'
import PurchaseOrderDetail from './pages/PurchaseOrderDetail'
import PurchaseReceives from './pages/PurchaseReceives'
import PurchaseReceiveForm from './pages/PurchaseReceiveForm'
import Bills from './pages/Bills'
import BillForm from './pages/BillForm'
import BillDetail from './pages/BillDetail'
import PaymentsOut from './pages/PaymentsOut'
import PaymentOutForm from './pages/PaymentOutForm'

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
          <Route path="warehouses"       element={<Warehouses />} />
          <Route path="warehouse-stock"  element={<WarehouseStock />} />
          <Route path="stock-movements"  element={<StockMovements />} />
          <Route path="reports"          element={<Reports />} />
          <Route path="customers"        element={<Customers />} />
          <Route path="customers/new"    element={<CustomerForm />} />
          <Route path="customers/:id/edit" element={<CustomerForm />} />
          <Route path="invoices"         element={<Invoices />} />
          <Route path="invoices/new"     element={<InvoiceForm />} />
          <Route path="invoices/:id/edit" element={<InvoiceForm />} />
          <Route path="invoices/:id"     element={<InvoiceDetail />} />

          {/* Procure to pay */}
          <Route path="purchase-orders"           element={<PurchaseOrders />} />
          <Route path="purchase-orders/new"       element={<PurchaseOrderForm />} />
          <Route path="purchase-orders/:id/edit"  element={<PurchaseOrderForm />} />
          <Route path="purchase-orders/:id"       element={<PurchaseOrderDetail />} />
          <Route path="purchase-receives"         element={<PurchaseReceives />} />
          <Route path="purchase-receives/new"     element={<PurchaseReceiveForm />} />
          <Route path="bills"                     element={<Bills />} />
          <Route path="bills/new"                 element={<BillForm />} />
          <Route path="bills/:id"                 element={<BillDetail />} />
          <Route path="payments-out"              element={<PaymentsOut />} />
          <Route path="payments-out/new"          element={<PaymentOutForm />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
