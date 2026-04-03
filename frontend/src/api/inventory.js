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
