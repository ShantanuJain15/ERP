// Central API calls for inventory module
import api from './axiosInstance'

// Auth
export const login  = (data) => api.post('/auth/token/', data)
export const logout = ()     => api.post('/auth/token/blacklist/')

// Products
export const getProducts    = (params) => api.get('/inventory/products/', { params })
export const getProduct     = (id)     => api.get(`/inventory/products/${id}/`)
export const createProduct  = (data)   => api.post('/inventory/products/', data)
export const updateProduct  = (id, d)  => api.put(`/inventory/products/${id}/`, d)
export const deleteProduct  = (id)     => api.delete(`/inventory/products/${id}/`)

// Categories
export const getCategories   = ()      => api.get('/inventory/categories/')
export const createCategory  = (data)  => api.post('/inventory/categories/', data)
export const updateCategory  = (id, d) => api.put(`/inventory/categories/${id}/`, d)
export const deleteCategory  = (id)    => api.delete(`/inventory/categories/${id}/`)

// Suppliers
export const getSuppliers   = ()      => api.get('/inventory/suppliers/')
export const createSupplier = (data)  => api.post('/inventory/suppliers/', data)
export const updateSupplier = (id, d) => api.put(`/inventory/suppliers/${id}/`, d)
export const deleteSupplier = (id)    => api.delete(`/inventory/suppliers/${id}/`)

// Stock Movements
export const getStockMovements  = (params) => api.get('/inventory/stock-movements/', { params })
export const createStockMovement = (data)  => api.post('/inventory/stock-movements/', data)

// Dashboard
export const getDashboardStats = () => api.get('/inventory/dashboard/stats/')


//Customers
export const getCustomers   = ()      => api.get('/inventory/customers/')
export const getCustomer    = (id)    => api.get(`/inventory/customers/${id}/`)
export const createCustomer = (data)  => api.post('/inventory/customers/', data)
export const updateCustomer = (id, d) => api.put(`/inventory/customers/${id}/`, d)
export const deleteCustomer = (id)    => api.delete(`/inventory/customers/${id}/`)

// Invoices
export const getInvoices      = (params) => api.get('/inventory/invoices/', { params })
export const getInvoice       = (id)     => api.get(`/inventory/invoices/${id}/`)
export const createInvoice    = (data)   => api.post('/inventory/invoices/', data)
export const updateInvoice    = (id, d)  => api.put(`/inventory/invoices/${id}/`, d)
export const patchInvoice     = (id, d)  => api.patch(`/inventory/invoices/${id}/`, d)
export const deleteInvoice    = (id)     => api.delete(`/inventory/invoices/${id}/`)
export const downloadInvoicePdf = (id)  => api.get(`/inventory/invoices/${id}/download_pdf/`, { responseType: 'blob' })
export const sendInvoiceEmail   = (id, email) => api.post(`/inventory/invoices/${id}/send_email_pdf/`, { email })

// Invoice Items
export const getInvoiceItems    = (params) => api.get('/inventory/invoicesitem/', { params })
export const createInvoiceItem  = (data)   => api.post('/inventory/invoicesitem/', data)
export const updateInvoiceItem  = (id, d)  => api.put(`/inventory/invoicesitem/${id}/`, d)
export const deleteInvoiceItem  = (id)     => api.delete(`/inventory/invoicesitem/${id}/`)
