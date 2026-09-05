# Master data

The reference records everything else points at: who we deal with, what we sell, where we keep it.

Master data has no lifecycle and no stock or money effects — it is *referenced by* documents rather
than being one. That makes it feel low-stakes, which is a trap: it's the hardest thing to change
later, because by then every document in the system points at it.

**Status:** design. See [Open questions](#open-questions).

---

## Entities

| Entity | Status | Notes |
|---|---|---|
| `Supplier` | implemented | Near-identical to `Customer` |
| `Customer` | implemented | No GSTIN, no state, no billing/shipping split |
| `Warehouse` | implemented | Fine as-is |
| `Product` | implemented | No HSN, no category FK, no UoM, no cost price |
| `ACProduct` | implemented | 1:1 extension; won't scale past a few product types |
| `Category` | **missing** | Frontend calls `/inventory/categories/` → 404 |
| `Brand` | **missing** | Currently free text on `Product` |
| `HSNCode` | **missing** | Statutory; required on every GST invoice |
| `UnitOfMeasure` | **missing** | Everything is implicitly "each" |
| `Address` / `Contact` | **missing** | Single `address` text field per party |

---

## The three decisions that matter

### 1. Party unification

`Supplier` and `Customer` have nearly the same fields, and both will need GSTIN, state, multiple
addresses, and a running balance. The standard move is one `Party` table with role flags
(`is_customer`, `is_supplier`), which also handles the real case where a supplier buys from you.

Against it: two tables are simpler, already exist, and already have data and API endpoints.

*Recommendation:* **unify** — but not first. Do it when you add GSTIN and addresses, so the
migration pays for itself by not being done twice.

### 2. Product typing

`ACProduct` as a 1:1 extension works for two types. At ten you have ten extension tables and every
query needs to know which to join.

Options: keep 1:1 extensions (simple, doesn't scale); a JSON `attributes` column (flexible,
unqueryable, no validation); or an `Attribute` / `AttributeValue` pair (the general answer, and
significantly more machinery).

*Recommendation:* **keep `ACProduct` for now.** If ACs are ~all of what you sell, generality here is
cost with no benefit. Revisit at the third product type — that's the real signal.

### 3. Category as a tree

Products need grouping (`Cooling > Air Conditioners > Split AC`). A self-FK `parent_id` is enough
at your scale; `django-mptt` is only worth it once you're querying whole subtrees constantly.

*Recommendation:* **plain self-FK.** Add the tree library only if a real query needs it.

---

## Invariants

| # | Rule | Enforced by |
|---|---|---|
| 1 | `sku` is unique and never reused | DB `unique` |
| 2 | Exactly one warehouse has `is_default = true` | partial unique index |
| 3 | A product with stock cannot be hard-deleted | `on_delete=PROTECT` (already on `StockMovement`) |
| 4 | Deactivating a product hides it from new documents, never from old ones | serializer filter, not deletion |
| 5 | Every product sold on a GST invoice has an HSN code | service guard at invoice issue |
| 6 | GSTIN, if present, is 15 chars and matches the state code | model validator |

Invariant 2 has no enforcement today — nothing stops two default warehouses, and the stock service
picks one arbitrarily if that happens.

---

## Schema

See [`schema.dbml`](schema.dbml), *Master data* group. New tables: `category`, `hsn_code`.
`brand`, `unit_of_measure`, `address`, `contact` are deferred pending the questions below.

---

## Open questions

**1. Is a supplier ever also a customer?** → If yes, unify into `Party` sooner rather than later.

**2. Do you need multiple addresses per customer?** Billing vs shipping differ often in B2B, and GST
place-of-supply comes from the *shipping* address. → *Recommend:* yes, an `Address` table.

**3. Is `brand` worth its own table?** Only if you need per-brand reporting, brand-level discounts,
or a brand logo on invoices. → *Recommend:* yes for an AC dealer — brand-wise sales is a report
you'll want. Cheap now, annoying later.

**4. Do you sell anything not counted in whole units?** Copper piping (metres), gas (kg),
installation labour (hours). → **This is the one that cannot be deferred.** If yes, every quantity
column must be `decimal(12,3)` from the start, and a `UnitOfMeasure` table is required.

**5. Are GST rates per product, per HSN, or per line?** → *Recommend:* the rate lives on `HSNCode` as
the default, and is **snapshotted onto each invoice line** at issue. Rates change; issued invoices
must not.

**6. One company, or several?** Multiple GSTINs or legal entities means a `Company` FK on every
document. → *Assuming one.* Say if not — this is structural and affects every table.
