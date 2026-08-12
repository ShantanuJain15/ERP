import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MdArrowDownward,
  MdInventory2,
  MdRefresh,
  MdSearch,
  MdWarehouse,
} from 'react-icons/md'
import { getProducts, getWarehouseStock, getWarehouses } from '../api/inventory'

const asArray = (data) => Array.isArray(data) ? data : data?.results ?? []

export default function WarehouseStock() {
  const [searchParams] = useSearchParams()
  const productParam = searchParams.get('product') || 'All'
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [search, setSearch] = useState('')
  const [warehouse, setWarehouse] = useState('All')
  const [product, setProduct] = useState(productParam)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const productMap = useMemo(
    () => new Map(products.map(item => [Number(item.id), item])),
    [products]
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (search.trim()) params.search = search.trim()
      if (warehouse !== 'All') params.warehouse = warehouse
      if (product !== 'All') params.product = product

      const [stockRes, productRes, warehouseRes] = await Promise.all([
        getWarehouseStock(params),
        getProducts(),
        getWarehouses({ is_active: true }),
      ])

      setRows(asArray(stockRes.data))
      setProducts(asArray(productRes.data))
      setWarehouses(asArray(warehouseRes.data))
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load warehouse stock')
    } finally {
      setLoading(false)
    }
  }, [product, search, warehouse])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    setProduct(productParam)
  }, [productParam])

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.quantity += Number(row.quantity || 0)
    acc.reserved += Number(row.reserved_quantity || 0)
    acc.available += Number(row.available_quantity || 0)
    return acc
  }, { quantity: 0, reserved: 0, available: 0 }), [rows])

  const isLowStock = (row) => {
    const item = productMap.get(Number(row.product))
    return item?.reorder_level != null && Number(row.available_quantity || 0) <= Number(item.reorder_level || 0)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Warehouse Stock</div>
          <div className="page-subtitle">Current product quantity per warehouse</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchData} title="Refresh">
          <MdRefresh />
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          color: 'var(--danger)', fontSize: 14, display: 'flex', justifyContent: 'space-between'
        }}>
          {error}
          <button onClick={fetchData} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 180, padding: '16px 20px' }}>
          <div className="stat-icon" style={{ width: 42, height: 42, fontSize: 18 }}><MdInventory2 /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{totals.quantity}</div>
            <div className="stat-label">On Hand</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 180, padding: '16px 20px' }}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)', width: 42, height: 42, fontSize: 18 }}><MdWarehouse /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)' }}>{totals.reserved}</div>
            <div className="stat-label">Reserved</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 180, padding: '16px 20px' }}>
          <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', width: 42, height: 42, fontSize: 18 }}><MdArrowDownward /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{totals.available}</div>
            <div className="stat-label">Available</div>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ maxWidth: 340 }}>
          <MdSearch style={{ color: 'var(--text-muted)', fontSize: 18 }} />
          <input placeholder="Search product, SKU, or warehouse..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ maxWidth: 220 }} value={warehouse} onChange={e => setWarehouse(e.target.value)}>
          <option value="All">All warehouses</option>
          {warehouses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 260 }} value={product} onChange={e => setProduct(e.target.value)}>
          <option value="All">All products</option>
          {products.map(item => <option key={item.id} value={item.id}>{item.name} {item.sku ? `(${item.sku})` : ''}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Warehouse</th><th>Quantity</th><th>Reserved</th><th>Available</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">WS</div>
                  <div className="empty-state-text">No warehouse stock found</div>
                  <div className="empty-state-sub">Record a stock movement to create warehouse stock</div>
                </div>
              </td></tr>
            ) : rows.map(row => (
              <tr key={row.id}>
                <td style={{ fontWeight: 500 }}>{row.product_name || row.product}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent-light)' }}>{row.product_sku || '-'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{row.warehouse_name || row.warehouse}</td>
                <td style={{ fontWeight: 700 }}>{row.quantity}</td>
                <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{row.reserved_quantity}</td>
                <td style={{ color: Number(row.available_quantity) > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{row.available_quantity}</td>
                <td>{isLowStock(row) ? <span className="badge badge-warning">Low Stock</span> : <span className="badge badge-success">OK</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
