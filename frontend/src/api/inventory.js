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
export const getSuppliers   = (params) => api.get('/inventory/suppliers/', { params })
export const createSupplier = (data)  => api.post('/inventory/suppliers/', data)
export const updateSupplier = (id, d) => api.put(`/inventory/suppliers/${id}/`, d)
export const deleteSupplier = (id)    => api.delete(`/inventory/suppliers/${id}/`)

// Warehouses
export const getWarehouses   = (params) => api.get('/inventory/warehouses/', { params })
export const getWarehouse    = (id)     => api.get(`/inventory/warehouses/${id}/`)
export const createWarehouse = (data)   => api.post('/inventory/warehouses/', data)
export const updateWarehouse = (id, d)  => api.put(`/inventory/warehouses/${id}/`, d)
export const patchWarehouse  = (id, d)  => api.patch(`/inventory/warehouses/${id}/`, d)
export const deleteWarehouse = (id)     => api.delete(`/inventory/warehouses/${id}/`)

// Warehouse Stock
export const getWarehouseStock = (params) => api.get('/inventory/warehouse-stock/', { params })

// Stock Movements
export const getStockMovements  = (params) => api.get('/inventory/stock-movements/', { params })
export const createStockMovement = (data)  => api.post('/inventory/stock-movements/', data)
export const getStockMovementStats = (params) => api.get('/inventory/stock-movements/stats/', { params })

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
// `template` is 'standard' | 'classic' — matches the switch on the invoice
// detail page, so the PDF looks like the document that was on screen.
export const downloadInvoicePdf = (id, template) =>
  api.get(`/inventory/invoices/${id}/download_pdf/`, { params: { template }, responseType: 'blob' })
export const sendInvoiceEmail   = (id, email, template) =>
  api.post(`/inventory/invoices/${id}/send_email_pdf/`, { email, template })
export const getNextInvoiceNumber = ()        => api.get('/inventory/invoices/next-number/')
export const getInvoiceVersionHistory = (id)  => api.get(`/inventory/invoices/${id}/version-history/`)

// Invoice Items
export const getInvoiceItems    = (params) => api.get('/inventory/invoicesitem/', { params })
export const createInvoiceItem  = (data)   => api.post('/inventory/invoicesitem/', data)
export const updateInvoiceItem  = (id, d)  => api.put(`/inventory/invoicesitem/${id}/`, d)
export const deleteInvoiceItem  = (id)     => api.delete(`/inventory/invoicesitem/${id}/`)

// HSN Codes — statutory classification; supplies the default GST rate per product
export const getHsnCodes   = (params) => api.get('/inventory/hsn-codes/', { params })
export const createHsnCode = (data)   => api.post('/inventory/hsn-codes/', data)

// Purchase Orders
export const getPurchaseOrders   = (params) => api.get('/inventory/purchase-orders/', { params })
export const getPurchaseOrder    = (id)     => api.get(`/inventory/purchase-orders/${id}/`)
export const createPurchaseOrder = (data)   => api.post('/inventory/purchase-orders/', data)
export const updatePurchaseOrder = (id, d)  => api.put(`/inventory/purchase-orders/${id}/`, d)
export const deletePurchaseOrder = (id)     => api.delete(`/inventory/purchase-orders/${id}/`)
export const getNextPoNumber     = ()       => api.get('/inventory/purchase-orders/next-number/')
export const submitPurchaseOrder = (id)     => api.post(`/inventory/purchase-orders/${id}/submit/`)
export const cancelPurchaseOrder = (id)     => api.post(`/inventory/purchase-orders/${id}/cancel/`)
export const closePurchaseOrder  = (id)     => api.post(`/inventory/purchase-orders/${id}/close/`)

// Purchase Receives (Goods Receipt / GRN) — the document that moves stock IN
export const getPurchaseReceives   = (params) => api.get('/inventory/purchase-receives/', { params })
export const getPurchaseReceive    = (id)     => api.get(`/inventory/purchase-receives/${id}/`)
export const createPurchaseReceive = (data)   => api.post('/inventory/purchase-receives/', data)
export const updatePurchaseReceive = (id, d)  => api.put(`/inventory/purchase-receives/${id}/`, d)
export const deletePurchaseReceive = (id)     => api.delete(`/inventory/purchase-receives/${id}/`)
export const getNextGrnNumber      = ()       => api.get('/inventory/purchase-receives/next-number/')
export const confirmPurchaseReceive = (id)    => api.post(`/inventory/purchase-receives/${id}/confirm/`)
export const cancelPurchaseReceive  = (id)    => api.post(`/inventory/purchase-receives/${id}/cancel/`)

// Bills (supplier purchase invoices)
export const getBills        = (params) => api.get('/inventory/bills/', { params })
export const getBill         = (id)     => api.get(`/inventory/bills/${id}/`)
export const createBill      = (data)   => api.post('/inventory/bills/', data)
export const updateBill      = (id, d)  => api.put(`/inventory/bills/${id}/`, d)
export const deleteBill      = (id)     => api.delete(`/inventory/bills/${id}/`)
export const getNextBillNumber = ()     => api.get('/inventory/bills/next-number/')
export const confirmBill     = (id)     => api.post(`/inventory/bills/${id}/confirm/`)
export const cancelBill      = (id)     => api.post(`/inventory/bills/${id}/cancel/`)
export const getSupplierOutstanding = (params) => api.get('/inventory/bills/outstanding/', { params })

// Payments Out
export const getPaymentsOut   = (params) => api.get('/inventory/payments-out/', { params })
export const getPaymentOut    = (id)     => api.get(`/inventory/payments-out/${id}/`)
export const createPaymentOut = (data)   => api.post('/inventory/payments-out/', data)
export const updatePaymentOut = (id, d)  => api.put(`/inventory/payments-out/${id}/`, d)
export const deletePaymentOut = (id)     => api.delete(`/inventory/payments-out/${id}/`)
export const getNextPayoutNumber = ()    => api.get('/inventory/payments-out/next-number/')
