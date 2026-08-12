# Inventory Data Model

This document describes the current inventory database model for the ERP system.
Inventory tables are MySQL-owned and the Django inventory models use `managed = False`, so table creation and table changes are handled through SQL, not Django migrations.

## Stock Model

Stock management is intentionally simple:

- `Warehouse`: where stock is stored.
- `WarehouseStock`: current product quantity per warehouse.
- `StockMovement`: immutable log of every stock change.

There is no zone, rack, shelf, bin, batch, or serial tracking in this version.

## Entity Relationship Summary

```text
Supplier 1 --- many Product
Supplier 1 --- many PurchaseOrder

Warehouse 1 --- many WarehouseStock
Warehouse 1 --- many StockMovement
Warehouse 1 --- many PurchaseOrder
Warehouse 1 --- many SalesOrder

Product 1 --- 0..1 ACProduct
Product 1 --- many WarehouseStock
Product 1 --- many StockMovement
Product 1 --- many POLineItem
Product 1 --- many SOLineItem
Product 1 --- many InvoiceItem

PurchaseOrder 1 --- many POLineItem
SalesOrder 1 --- many SOLineItem
Customer 1 --- many Invoice
Invoice 1 --- many InvoiceItem
```

## Core Inventory Tables

### Warehouse

Stores warehouse master data.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | BigAutoField | Yes | Primary key. |
| code | CharField(50) | Yes | Unique warehouse code. |
| name | CharField(255) | Yes | Warehouse name. |
| warehouse_type | CharField(20) | Yes | `MAIN`, `BRANCH`, `STORE`, or `VIRTUAL`. |
| address | TextField | No | Address text. |
| city | CharField(100) | No | City. |
| state | CharField(100) | No | State. |
| country | CharField(100) | No | Country. |
| phone | CharField(30) | No | Phone number. |
| is_default | BooleanField | Yes | Marks the default warehouse. |
| is_active | BooleanField | Yes | Controls whether the warehouse is usable. |
| created_at | DateTimeField | Yes | Created timestamp. |
| updated_at | DateTimeField | Yes | Updated timestamp. |

### WarehouseStock

Stores the current stock balance for one product in one warehouse.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | BigAutoField | Yes | Primary key. |
| warehouse | ForeignKey(Warehouse) | Yes | Deletes with warehouse. |
| product | ForeignKey(Product) | Yes | Deletes with product. |
| quantity | IntegerField | Yes | On-hand quantity. Negative stock is blocked by the service layer. |
| reserved_quantity | PositiveIntegerField | Yes | Reserved but not yet dispatched quantity. |
| updated_at | DateTimeField | Yes | Updated timestamp. |

Constraints:
- Unique combination: `warehouse`, `product`.

Computed property:
- `available_quantity = quantity - reserved_quantity`.

### StockMovement

Stores the immutable movement ledger. Every stock change should create one row here.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | BigAutoField | Yes | Primary key. |
| movement_number | CharField(50) | Yes | Unique movement number such as `SM-000001`. |
| warehouse | ForeignKey(Warehouse) | Yes | Protected from warehouse deletion. |
| product | ForeignKey(Product) | Yes | Protected from product deletion. |
| movement_type | CharField(20) | Yes | `IN`, `OUT`, `ADJ_UP`, `ADJ_DOWN`, `RETURN`, `DAMAGE`. |
| quantity | PositiveIntegerField | Yes | User-entered positive quantity. |
| quantity_change | IntegerField | Yes | Signed quantity applied to stock. |
| reference_type | CharField(20) | Yes | `PO`, `SO`, `INVOICE`, or `MANUAL`. |
| reference_number | CharField(100) | No | External document number. |
| notes | TextField | No | Notes or reason. |
| performed_by | CharField(150) | No | Username or actor label. |
| created_at | DateTimeField | Yes | Created timestamp. |

Movement sign rules:

| Type | Sign |
| --- | --- |
| `IN` | Positive |
| `RETURN` | Positive |
| `ADJ_UP` | Positive |
| `OUT` | Negative |
| `DAMAGE` | Negative |
| `ADJ_DOWN` | Negative |

Behavior:
- `record_stock_movement(...)` creates the movement.
- It updates or creates the matching `WarehouseStock`.
- It syncs `Product.quantity` to the total `WarehouseStock.quantity` across all warehouses.
- It blocks stock-out movements that would make the warehouse balance negative.

## Product Tables

### Product

Stores the product catalog.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | BigAutoField | Yes | Primary key. |
| name | CharField(255) | Yes | Product name. |
| type | CharField(20) | No | `AC` or `GENERIC`. |
| sku | CharField(64) | No | Unique SKU. |
| brand | CharField(100) | No | Product brand. |
| description | TextField | No | Product description. |
| price | DecimalField(10,2) | Yes | Sales price. |
| quantity | IntegerField | Yes | Aggregate stock across warehouses. |
| reorder_level | PositiveIntegerField | Yes | Low-stock threshold. |
| supplier | ForeignKey(Supplier) | No | Optional supplier. |
| is_active | BooleanField | Yes | Active flag. |
| last_modified_by_username | CharField(150) | No | Last editor username. |
| created_at | DateTimeField | Yes | Created timestamp. |
| updated_at | DateTimeField | Yes | Updated timestamp. |

### ACProduct

One-to-one AC-specific extension for `Product`.

Fields: `product`, `tonnage`, `star_rating`, `energy_label`, and `refrigerant_type`.

## Other Business Tables

- `Supplier`: vendor master data.
- `PurchaseOrder` and `POLineItem`: purchase order header and lines.
- `SalesOrder` and `SOLineItem`: sales order header and lines.
- `Customer`: customer master data.
- `Invoice` and `InvoiceItem`: billing header and lines.

## API Surface

```text
GET/POST      /api/inventory/warehouses/
GET/PATCH     /api/inventory/warehouses/<id>/

GET           /api/inventory/warehouse-stock/
GET           /api/inventory/warehouse-stock/<id>/

GET/POST      /api/inventory/stock-movements/
GET           /api/inventory/stock-movements/stats/
```

Stock movement create payload:

```json
{
  "warehouse": 1,
  "product": 1,
  "movement_type": "IN",
  "quantity": 10,
  "reference_type": "MANUAL",
  "reference_number": "ADJ-001",
  "notes": "Opening stock"
}
```

## Important Notes

- Inventory tables are unmanaged in Django, so update `backend/sql/inventory_schema.sql` when model tables change.
- `Product.quantity` is a denormalized aggregate and should be updated through the stock service.
- Invoice item stock deduction still directly updates `Product.quantity`; it should be moved to `record_stock_movement(...)` before invoices are treated as stock-affecting documents.
