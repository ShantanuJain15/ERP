# Glossary

Shared definitions. Half of all data-modelling disputes are two people using the same word for
different things — "order" especially. When a term here conflicts with how the code currently
uses it, that conflict is noted, because it's usually a bug waiting to be found.

Entries marked **⚠ DECIDE** are unresolved. They need a business answer before the related module
is implemented.

---

## Parties

**Party** — any external organisation or person we transact with. A supplier and a customer are
both parties: both have addresses, contacts, a GSTIN, and a running balance with us. Today they
are two unrelated tables (`Supplier`, `Customer`) with near-identical fields.
**⚠ DECIDE:** unify into one `Party` with a role flag, or keep separate? Unifying is the standard
choice and handles the case where a supplier is also a customer.

**Customer** — a party we sell to. Currently `inventory_customer`, keyed by unique `phone` and
`email`.

**Supplier** — a party we buy from. Currently `inventory_supplier`.

**GSTIN** — the 15-character GST registration number of a party. Determines whether a sale is
intra-state (CGST + SGST) or inter-state (IGST). Not currently stored anywhere.

**Place of supply** — the state that decides which GST applies. Usually the customer's state, but
not always. Drives the CGST/SGST vs IGST split on every invoice.

---

## Products

**Product** — something we buy, hold, and sell. Currently `inventory_product`, unique on `sku`.

**SKU** — our internal code for a product. Unique, stable, never reused. The thing a warehouse
person reads off a shelf label.

**HSN code** — the government's product classification code, printed on every GST invoice and
determining the tax rate. Distinct from SKU: SKU is ours, HSN is statutory. Not currently stored.

**Category / Brand** — how products are grouped for browsing and reporting. `brand` is currently a
free-text field on `Product`; there is no `Category` model at all, though the frontend already
calls `/inventory/categories/` and gets a 404.

**Unit of measure (UoM)** — how a product is counted: each, box, metre, kg. Everything today is
implicitly "each" (all quantities are integers).
**⚠ DECIDE:** do we ever sell in a unit other than "each"? Copper piping and gas would be metres
and kg. If yes, this is structural and must land early.

**Serial number** — the manufacturer's unique identifier for one physical unit. Every AC has one,
and warranty attaches to it. Not currently tracked, which means we cannot answer "is this specific
unit still under warranty?"

**Batch** — a group of identical units sharing an expiry or production run. Probably not needed for
ACs; relevant if we ever stock consumables.

---

## Stock

**On-hand quantity** — physically present in a warehouse right now. `WarehouseStock.quantity`.

**Reserved quantity** — on-hand but already promised to a confirmed order, so not sellable.
`WarehouseStock.reserved_quantity` exists but **nothing currently writes to it**.

**Available quantity** — `on-hand − reserved`. What we can actually promise a new customer.
Already implemented as `WarehouseStock.available_quantity`.

**Stock movement** — one append-only record of stock changing. Never edited, never deleted; a
mistake is corrected by a new, opposite movement. `inventory_stockmovement`. This is the correct
pattern and the thing to generalise as the system grows.

**Warehouse** — a place stock is held. Includes non-physical ones (`VIRTUAL`) used to park stock
that is in transit or written off.

**Stock valuation** — what the stock we hold is worth. Requires knowing purchase cost, which we
don't currently store anywhere — so margin and stock value are both uncomputable today.

---

## Documents

A **document** is a record of a business event. Documents are never deleted: they are cancelled,
which leaves the record and reverses its effects. Each has a lifecycle and a defined moment at
which it *posts* — takes effect on stock or money.

**Quotation** — a price offered to a customer. No commitment, no stock effect. Not yet modelled.

**Sales Order (SO)** — a customer's confirmed intent to buy. Reserves stock; does not move it.
Currently `inventory_salesorder`, but it stores `customer_name` / `customer_phone` as free text
instead of linking to `Customer` — so we cannot ask what a given customer has ordered.

**Delivery Note** — goods physically leaving the warehouse. **This is what moves stock.** Not yet
modelled; stock currently moves on the invoice instead.

**Invoice** — the demand for payment, and the GST document. Creates a receivable.
Currently `inventory_invoice`. Links to `Customer` but **not** to `SalesOrder` or `Warehouse` —
and the missing warehouse link is why `InvoiceItem.save()` reaches around the stock service to
mutate `Product.quantity` directly.

**Payment** — money actually received. Not modelled: `Invoice.paid_amount` is a single number, so
payment history cannot be reconstructed even though the Pine Labs integration generates payment
events.

**Credit Note** — cancels or reduces an invoice after issue. Required by GST; you cannot legally
just edit an issued invoice. The existing invoice *versioning* is reaching for this.

**Purchase Order (PO)** — our commitment to buy from a supplier. `inventory_purchaseorder`.

**Goods Receipt (GRN)** — stock physically arriving from a supplier. **This is what moves stock in.**
Not modelled; `POLineItem.quantity_received` conflates ordering with receiving, so partial
deliveries across multiple dates cannot be recorded.

**Bill / Purchase Invoice** — the supplier's demand for payment. Creates a payable. Not modelled.

---

## Money

**Unit price** — price for one unit on a specific document line. Always **snapshotted** onto the
line at the time the document is created, never read live from `Product.price` — otherwise
changing a price would silently rewrite history on old invoices. `POLineItem.unit_price` and
`InvoiceItem.price` already do this correctly.

**Cost price vs selling price** — what we paid vs what we charge. `Product.price` is a single
number, so these are conflated and margin is uncomputable.
**⚠ DECIDE:** track cost per product, or per goods receipt (so cost can vary by purchase)?
Per-receipt is more accurate and is what enables real valuation.

**Tax-inclusive vs tax-exclusive** — whether a quoted price already contains GST.
**⚠ DECIDE:** which do we quote in? This changes every price field's meaning and affects rounding
on every line. Retail in India is usually inclusive; B2B usually exclusive.

**Receivable** — money a customer owes us. **Payable** — money we owe a supplier. Neither exists
as a queryable concept today.

---

## Cross-cutting

**Document number** — the human-readable identifier (`PFE00001`, `PO-2024-0042`). Must be unique,
gapless within a series, and never reused. Currently generated by a `__regex` query inside
`InvoiceSerializer`, which races: two concurrent invoices can take the same number.

**Posting** — the moment a document takes effect. A draft invoice does nothing; a confirmed one
moves stock and creates a receivable. Knowing exactly when each document posts is most of what
this design work is for.

**Cancel vs delete** — we cancel. Cancelling keeps the record and reverses its effects with
compensating entries. Nothing is ever hard-deleted; `is_active` flags are the current stand-in.

**Audit trail** — who changed what, when. Currently a `last_modified_by_username` string on a few
tables, which records only the most recent change and loses all history.
