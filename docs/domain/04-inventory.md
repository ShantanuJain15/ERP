# Inventory

What we hold, where, what it's worth, and every change to it.

This is the module that is already closest to right. `StockMovement` is an append-only ledger with
a denormalized aggregate maintained by a service — that is the correct ERP pattern, and the work
here is to generalise it rather than replace it.

**Status:** partly implemented. `WarehouseStock` and `StockMovement` exist and work.

---

## The model as it stands

Three layers, which is the right number:

1. **`StockMovement`** — the append-only ledger. Every change, ever. Never edited, never deleted; a
   mistake is corrected by a new opposite movement.
2. **`WarehouseStock`** — current quantity per (warehouse, product). Derived from the ledger, kept
   current by the service for fast reads.
3. **`Product.quantity`** — the total across warehouses. Derived from `WarehouseStock`.

Layers 2 and 3 are *caches* of layer 1. That's a deliberate and correct trade: recomputing from the
ledger on every read doesn't scale, but the cache must only ever be written by the service that
also writes the ledger.

### Where it's violated

`InvoiceItem.save()` (`inventory/models.py:426-429`) writes `Product.quantity` directly, and
`InvoiceSerializer.update()` (`inventory/serializers.py:340-344`) does the same in reverse. Both
bypass `record_stock_movement()`. The result: the ledger and the cache silently diverge, and
`WarehouseStock` never learns about invoice sales at all.

The root cause is a **missing FK, not bad code** — `Invoice` has no warehouse, so the code has
nowhere to deduct from and reaches for the aggregate instead. Fix the schema
([03-order-to-cash.md](03-order-to-cash.md)) and the code fix becomes obvious.

**Fix both sides together.** They're mirror images; correcting only one leaves deduct and restore
asymmetric, which is harder to debug than the current consistent-but-wrong behaviour.

---

## What's missing

### Valuation

`StockMovement` records quantity but not value. Without cost on the way in, none of these are
computable: what our stock is worth, cost of goods sold, gross margin, or the effect of a
write-off.

The fix pairs with `goods_receipt_line.unit_cost` from [procure-to-pay](02-procure-to-pay.md): add
`unit_cost` and `value_change` to each movement, so the ledger carries value alongside quantity and
valuation becomes a sum rather than a reconstruction.

*Recommend:* **moving average** cost, not FIFO — much simpler to implement and explain, and adequate
unless FIFO is needed for audit. This decision is very hard to reverse once there's history.

### Serial numbers

Every AC has a manufacturer serial, and warranty attaches to the *unit*, not the product. Without
serial tracking you cannot answer "is this specific unit still under warranty?" — which is the
central question of the [service module](05-service.md).

*Recommend:* track serials for ACs. This is the strongest argument for building
[`05-service.md`](05-service.md) properly, and it must be decided before serials start arriving
untracked, because retrofitting means physically auditing existing stock.

### Reservation

`WarehouseStock.reserved_quantity` exists and **nothing writes to it**. Until sales orders reserve
stock, two staff can promise the same unit to different customers.

### Stock transfer

Moving stock between warehouses is currently two unrelated manual adjustments, so goods in transit
belong to neither warehouse and nothing links the two halves. A `StockTransfer` document with
`DRAFT → IN_TRANSIT → RECEIVED` fixes it.

### Reconciliation

When a physical count disagrees with the system, someone adjusts. Today that's an `ADJ_UP`/`ADJ_DOWN`
movement with a free-text note — no record of what was counted, by whom, or against what.

---

## Invariants

| # | Rule | Enforced by |
|---|---|---|
| 1 | Every stock change writes a `StockMovement` | **only the stock service may write stock** |
| 2 | `StockMovement` rows are never updated or deleted | no update path; corrections are new rows |
| 3 | `WarehouseStock.quantity == sum(movements for that warehouse+product)` | service; verifiable by query |
| 4 | `Product.quantity == sum(WarehouseStock.quantity)` | `sync_product_quantity()` |
| 5 | `WarehouseStock.quantity >= 0` | `CheckConstraint` |
| 6 | `reserved_quantity <= quantity` | `CheckConstraint` |
| 7 | `reserved_quantity >= 0` | `CheckConstraint` |
| 8 | `quantity_change` sign matches `movement_type` | `CheckConstraint` |
| 9 | Concurrent movements on the same row serialise | `select_for_update()` |
| 10 | A serial number is in at most one warehouse at a time | DB constraint |

Invariant 1 is the load-bearing one. If any code path can write stock without the service, every
other invariant becomes unenforceable.

Invariant 9 deserves a note: `record_stock_movement()` already calls `select_for_update()`, but on
SQLite that is **silently a no-op** — the row locks have never actually existed. On PostgreSQL or
MySQL it becomes a real lock and the race it was written to prevent is finally prevented.

Invariants 3 and 4 are checkable rather than enforceable, which makes them good candidates for a
`manage.py check_stock_integrity` command run periodically.

---

## Schema

See [`schema.dbml`](schema.dbml), *Stock* group.

Changes to `inventory_stockmovement`: add `unit_cost` and `value_change`; extend `reference_type`
with `GRN`, `DN`, `TRANSFER`, `RECONCILIATION`. Existing rows keep working — the new columns are
nullable for history.

New: `serial_number`. Deferred: `stock_transfer`, `stock_reconciliation`.

---

## Open questions

**1. Track serial numbers?** → *Recommend:* yes for ACs. Decide **before** more stock arrives —
retrofitting means a physical audit.

**2. Serials for every product, or only some?** → *Recommend:* a `track_serial` flag on `Product`.
ACs yes; copper piping no.

**3. Valuation method — moving average or FIFO?** → *Recommend:* moving average. Near-irreversible
once there's history.

**4. Should stock be allowed to go negative?** Some businesses allow it to avoid blocking a sale
when the system lags reality. → *Recommend:* **no.** A hard `CheckConstraint`. Negative stock hides
the real problem, which is that someone didn't record a receipt.

**5. Is there stock we hold but don't own?** Consignment from a manufacturer, or customer goods in
for repair. → If yes, an ownership flag on the warehouse, so it's excluded from valuation.

**6. How often is a physical count done?** → Determines whether `StockReconciliation` is worth
building or an `ADJ` movement is enough.

**7. Do you need stock ageing?** ("What's been sitting more than 90 days?") → Needs a receipt date
per unit or batch. Free if serials are tracked.
