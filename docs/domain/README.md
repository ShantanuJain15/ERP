# Domain design

This folder is where the ERP's business logic is **designed**, before it is implemented.

It exists because the schema had been growing table-by-table as features were added, which
produced gaps that only show up later — a `SalesOrder` that stores a customer's name as text
instead of linking to `Customer`, an `Invoice` with no link to the order it bills or the
warehouse it ships from, no tax entities at all. None of those are coding mistakes. They are
what happens when tables are added one at a time instead of designed as a whole.

## The one rule

> **DBML is where the schema is _designed_. `models.py` is where it is _implemented_.
> Design flows forward only.**

- **Table not yet built** → `schema.dbml` is the truth. Iterate freely; it's cheap here and
  expensive once there's a migration and data.
- **Table already built** → **`models.py` is the truth.** Mark it `// IMPLEMENTED` in the DBML
  and stop editing it there.
- **Never hand-sync backwards.** To check whether code drifted from the design, *generate* an
  ERD from the code and compare — don't retype it.

The previous `backend/dbml` rotted because this rule didn't exist. It became a hand-maintained
second copy of `models.py`, and a second copy always loses. Same for the hand-written MySQL DDL
in `backend/sql/` and the column tables in `backend/data_model.md`: every one of them is a
duplicate description of something `models.py` already states exactly.

## The process: design documents, not tables

ERP systems are **document-shaped**. Every business event is a document — Purchase Order, Goods
Receipt, Invoice, Payment, Stock Entry. Each has a lifecycle. Each posts into a ledger. Get the
documents and their state machines right and the tables fall out almost mechanically.

Starting from entities is what produces missing foreign keys. Writing the sentence *"the Invoice
bills a Sales Order"* makes an absent FK obvious in a way that staring at a table diagram does not.

Per module, in this order:

1. **Map the process** in plain sentences. *"A customer orders 3 ACs → we reserve stock → we
   deliver → we invoice → they pay → we install."* One paragraph per flow.
2. **List the documents.** For each: what it records, who creates it, and — most importantly —
   **what it _does_ when confirmed** (reserve stock? move stock? create a receivable?).
3. **Draw each document's state machine** as a Mermaid `stateDiagram-v2`. Always include the
   **cancel** path: ERPs never delete documents, they cancel and reverse them.
4. **Write the invariants in plain English.** *"Stock can never go negative in a warehouse."*
   *"A confirmed invoice cannot be edited."* Write them as sentences first; decide enforcement
   (DB constraint vs service guard) second.
5. **Now write the DBML.** Entities come from documents. Most will be a header/lines pair.
6. **Review, then implement** in `models.py` — and mark those tables implemented in the DBML.

**Design one module end to end before starting the next.** A complete order-to-cash beats six
half-modelled ones.

## Layout

| File | Covers |
|---|---|
| `00-glossary.md` | What *we* mean by each term. Read this first. |
| `01-master-data.md` | Party, Product, Category, Brand, UoM, Warehouse, Tax |
| `02-procure-to-pay.md` | PO → Goods Receipt → Bill → Payment Out |
| `03-order-to-cash.md` | Quotation → SO → Delivery → Invoice → Payment In |
| `04-inventory.md` | Movements, valuation, serials, reconciliation |
| `05-service.md` | Installation jobs, warranty, AMC |
| `schema.dbml` | The design ERD — paste into [dbdiagram.io](https://dbdiagram.io) |

Every module file has the same sections: **Process → Documents → State machines → Invariants →
DBML fragment → Open questions**.

The **Open questions** sections are the most valuable part of this folder. That is where
*"does an invoice always need a sales order?"* gets recorded and answered deliberately, instead
of being guessed at silently by whoever writes the model first.

## Tools

- **[dbdiagram.io](https://dbdiagram.io)** — paste `schema.dbml`, get the full ERD. Free, no
  account. Auto-layout handles 25+ tables well.
- **Mermaid** — ` ```mermaid ` fences in these files. Renders natively in GitHub and VS Code, so
  state machines live next to the prose that explains them. Used for state diagrams and
  per-module ER fragments; the full ERD stays in DBML because Mermaid's layout doesn't scale.
- **Excalidraw / draw.io** — for sketching before entities are firm. Don't formalize too early.
- **`django-extensions` → `graph_models`** — generates an ERD *from* the code. For verifying
  design against reality after implementing. Not a design tool.

Deliberately **not** used: dbdocs.io (a hosted publish of the same DBML — no value for two
people), and DBML's SQL export (Django migrations generate the SQL; a second DDL source is
exactly what went wrong in `backend/sql/`).

## Reference: steal from ERPNext

[ERPNext](https://github.com/frappe/erpnext) is open source, built for the same scale of
business, and has strong Indian GST support. Its DocTypes are readable JSON field definitions.
Before designing a module, read the equivalent one there:

| Designing… | Read |
|---|---|
| Stock ledger | **Stock Ledger Entry** — note how valuation rides along with quantity |
| GST on invoices | **Sales Taxes and Charges** — tax as *rows*, not columns |
| Payments | **Payment Entry** — one payment allocating across several invoices |
| Serial/warranty | **Serial No**, **Warranty Claim** |
| Product variants | **Item**, **Item Group**, **Item Attribute** |

Copy the *shape* of the decisions, not the schema — ERPNext is built for far more generality
than we need.
