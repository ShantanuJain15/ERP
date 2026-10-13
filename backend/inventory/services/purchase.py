"""Procure-to-pay posting logic.

Every state transition that touches stock or money lives here, because there is
no workflow engine in this project — `status` is a plain CharField that any
PATCH could otherwise set to anything.

Two rules run through the whole file:

1. **Only the stock service writes stock.** Every movement goes through
   `record_stock_movement()`; nothing here touches `WarehouseStock` or
   `Product.quantity` directly. That is what the sales-side `InvoiceItem.save()`
   gets wrong, and why its ledger and its caches disagree.
2. **Cancelling reverses, never deletes.** A cancelled receipt writes a
   compensating OUT movement. The ledger is append-only.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from inventory.models import Bill, GoodsReceiptLine, POLineItem, PurchaseOrder
from inventory.services.stock import record_stock_movement


# ─── Purchase order ───────────────────────────────────────────────────────────

def sync_po_line_received(po_line):
    """Recompute `quantity_received` from confirmed receipt lines.

    Invariant 2: `po_line.quantity_received == sum(grn_lines)`. The column is a
    cache — the same pattern as WarehouseStock/Product.quantity — and this is
    the only function permitted to write it.
    """
    total = (
        GoodsReceiptLine.objects
        .filter(po_line_item=po_line, goods_receipt__status="RECEIVED")
        .aggregate(total=Sum("quantity"))
        .get("total")
        or 0
    )

    POLineItem.objects.filter(pk=po_line.pk).update(quantity_received=total)
    po_line.quantity_received = total
    return total


def sync_purchase_order_status(purchase_order):
    """Roll a PO forward based on what has actually been received.

    Deliberately does not touch DRAFT, CANCELLED or CLOSED: those are set by an
    explicit user action, and receiving goods should not silently reopen a
    closed order.
    """
    if purchase_order.status in {"DRAFT", "CANCELLED", "CLOSED"}:
        return purchase_order.status

    lines = list(purchase_order.line_items.all())
    if not lines:
        return purchase_order.status

    received_any = any(line.quantity_received > 0 for line in lines)
    received_all = all(line.quantity_received >= line.quantity_ordered for line in lines)

    if received_all:
        status = "RECEIVED"
    elif received_any:
        status = "PARTIALLY_RECEIVED"
    else:
        status = "SUBMITTED"

    if status != purchase_order.status:
        purchase_order.status = status
        purchase_order.save(update_fields=["status", "updated_at"])

    return status


@transaction.atomic
def submit_purchase_order(purchase_order):
    if purchase_order.status != "DRAFT":
        raise ValidationError({"status": f"Only a draft order can be submitted (this one is {purchase_order.status})."})
    if not purchase_order.line_items.exists():
        raise ValidationError({"line_items": "A purchase order must have at least one line."})

    purchase_order.status = "SUBMITTED"
    purchase_order.save(update_fields=["status", "updated_at"])
    return purchase_order


@transaction.atomic
def cancel_purchase_order(purchase_order):
    """Invariant 8: a PO cannot be cancelled once any goods have arrived.

    Close it short instead — the goods exist and the receipt referencing this
    order must stay valid.
    """
    if purchase_order.status in {"CANCELLED", "CLOSED"}:
        raise ValidationError({"status": f"This order is already {purchase_order.status}."})

    received = purchase_order.line_items.aggregate(total=Sum("quantity_received")).get("total") or 0
    if received > 0:
        raise ValidationError({
            "status": "Goods have already been received against this order. Close it short instead of cancelling."
        })

    purchase_order.status = "CANCELLED"
    purchase_order.save(update_fields=["status", "updated_at"])
    return purchase_order


@transaction.atomic
def close_purchase_order(purchase_order):
    """Close short: the supplier will not deliver the remainder."""
    if purchase_order.status not in {"SUBMITTED", "PARTIALLY_RECEIVED", "RECEIVED"}:
        raise ValidationError({"status": f"A {purchase_order.status} order cannot be closed."})

    purchase_order.status = "CLOSED"
    purchase_order.save(update_fields=["status", "updated_at"])
    return purchase_order


# ─── Goods receipt ────────────────────────────────────────────────────────────

def _guard_over_receipt(grn, allow_over_receipt=False):
    """Invariant 1: received never exceeds ordered without explicit approval.

    Checked across *all* confirmed receipts for the line, not just this one —
    otherwise three receipts of 4 against an order of 10 would each pass.
    """
    if allow_over_receipt:
        return

    for line in grn.lines.select_related("po_line_item").all():
        po_line = line.po_line_item
        if po_line is None:
            continue

        already = (
            GoodsReceiptLine.objects
            .filter(po_line_item=po_line, goods_receipt__status="RECEIVED")
            .exclude(goods_receipt_id=grn.pk)
            .aggregate(total=Sum("quantity"))
            .get("total")
            or 0
        )

        if already + line.quantity > po_line.quantity_ordered:
            raise ValidationError({
                "lines": (
                    f"{line.product.sku}: receiving {line.quantity} would bring the total to "
                    f"{already + line.quantity} against {po_line.quantity_ordered} ordered."
                )
            })


@transaction.atomic
def confirm_goods_receipt(grn, performed_by="", allow_over_receipt=False):
    """DRAFT -> RECEIVED. Posts stock IN, one movement per line."""
    if grn.status != "DRAFT":
        raise ValidationError({"status": f"Only a draft receipt can be confirmed (this one is {grn.status})."})

    lines = list(grn.lines.select_related("product", "po_line_item").all())
    if not lines:
        raise ValidationError({"lines": "A goods receipt must have at least one line."})

    _guard_over_receipt(grn, allow_over_receipt=allow_over_receipt)

    # Flip status first so sync_po_line_received() below counts this receipt.
    grn.status = "RECEIVED"
    grn.save(update_fields=["status", "updated_at"])

    for line in lines:
        record_stock_movement(
            warehouse=grn.warehouse,
            product=line.product,
            movement_type="IN",
            quantity=line.quantity,
            reference_type="GRN",
            reference_number=grn.grn_number,
            unit_cost=line.unit_cost,
            notes=f"Goods receipt {grn.grn_number}",
            performed_by=performed_by,
        )

    _resync_order_from_receipt(grn)
    return grn


@transaction.atomic
def cancel_goods_receipt(grn, performed_by=""):
    """Reverse a receipt with compensating movements. Never deletes."""
    if grn.status == "CANCELLED":
        raise ValidationError({"status": "This receipt is already cancelled."})

    was_posted = grn.status == "RECEIVED"
    lines = list(grn.lines.select_related("product", "po_line_item").all())

    grn.status = "CANCELLED"
    grn.save(update_fields=["status", "updated_at"])

    if was_posted:
        for line in lines:
            record_stock_movement(
                warehouse=grn.warehouse,
                product=line.product,
                movement_type="OUT",
                quantity=line.quantity,
                reference_type="GRN",
                reference_number=grn.grn_number,
                unit_cost=line.unit_cost,
                notes=f"Reversal of goods receipt {grn.grn_number}",
                performed_by=performed_by,
            )

    _resync_order_from_receipt(grn)
    return grn


def _resync_order_from_receipt(grn):
    """Recompute the received cache and PO status touched by this receipt."""
    po_lines = {line.po_line_item for line in grn.lines.all() if line.po_line_item_id}
    for po_line in po_lines:
        sync_po_line_received(po_line)

    if grn.purchase_order_id:
        purchase_order = PurchaseOrder.objects.get(pk=grn.purchase_order_id)
        sync_purchase_order_status(purchase_order)


# ─── Bill ─────────────────────────────────────────────────────────────────────

def guard_billed_within_received(bill):
    """Invariant 6: billed quantity never exceeds received quantity.

    Skipped when the bill posts its own stock — on that path the bill *is* the
    receipt, so there is nothing to compare against.
    """
    if bill.updates_stock:
        return

    for line in bill.lines.select_related("goods_receipt_line", "product").all():
        grn_line = line.goods_receipt_line
        if grn_line is None:
            continue

        already = (
            grn_line.bill_lines
            .exclude(bill_id=bill.pk)
            .exclude(bill__status="CANCELLED")
            .aggregate(total=Sum("quantity"))
            .get("total")
            or 0
        )

        if already + line.quantity > grn_line.quantity:
            raise ValidationError({
                "lines": (
                    f"{line.product.sku}: billing {line.quantity} would bring the total to "
                    f"{already + line.quantity} against {grn_line.quantity} received."
                )
            })


def guard_stock_posting_bill(bill):
    """Invariant 10: a stock-posting bill must not also reference receipt lines.

    Allowing both is the double-count — the GRN already moved those goods.
    """
    if not bill.updates_stock:
        return

    if bill.warehouse_id is None:
        raise ValidationError({"warehouse": "A bill that posts stock must name a warehouse."})

    if bill.lines.filter(goods_receipt_line__isnull=False).exists():
        raise ValidationError({
            "updates_stock": (
                "This bill is linked to a goods receipt, which already moved the stock. "
                "Turn off 'updates stock' or remove the receipt link."
            )
        })


@transaction.atomic
def confirm_bill(bill, performed_by=""):
    """DRAFT -> RECEIVED. Creates the payable, and posts stock if it is the receipt."""
    if bill.status != "DRAFT":
        raise ValidationError({"status": f"Only a draft bill can be confirmed (this one is {bill.status})."})

    lines = list(bill.lines.select_related("product").all())
    if not lines:
        raise ValidationError({"lines": "A bill must have at least one line."})

    guard_stock_posting_bill(bill)
    guard_billed_within_received(bill)

    bill.status = "RECEIVED"
    if bill.due_date is None:
        bill.due_date = compute_due_date(bill)
    bill.save(update_fields=["status", "due_date", "updated_at"])

    if bill.updates_stock:
        for line in lines:
            record_stock_movement(
                warehouse=bill.warehouse,
                product=line.product,
                movement_type="IN",
                quantity=line.quantity,
                reference_type="BILL",
                reference_number=bill.bill_number,
                # GST-exclusive: input tax is reclaimable credit, not item cost.
                unit_cost=line.unit_price,
                notes=f"Bill {bill.bill_number}",
                performed_by=performed_by,
            )

    return bill


@transaction.atomic
def cancel_bill(bill, performed_by=""):
    if bill.status == "CANCELLED":
        raise ValidationError({"status": "This bill is already cancelled."})
    if bill.allocations.exists():
        raise ValidationError({
            "status": "Payments have been allocated to this bill. Remove them before cancelling."
        })

    posted_stock = bill.updates_stock and bill.status != "DRAFT"
    lines = list(bill.lines.select_related("product").all())

    bill.status = "CANCELLED"
    bill.save(update_fields=["status", "updated_at"])

    if posted_stock:
        for line in lines:
            record_stock_movement(
                warehouse=bill.warehouse,
                product=line.product,
                movement_type="OUT",
                quantity=line.quantity,
                reference_type="BILL",
                reference_number=bill.bill_number,
                unit_cost=line.unit_price,
                notes=f"Reversal of bill {bill.bill_number}",
                performed_by=performed_by,
            )

    return bill


def compute_due_date(bill):
    terms = bill.supplier.payment_terms_days if bill.supplier_id else 0
    base = bill.bill_date
    if base is None:
        return None

    from datetime import timedelta
    return base + timedelta(days=terms or 0)


def sync_bill_payment_status(bill):
    """Derive PAID / PARTIALLY_PAID / RECEIVED from allocations.

    `paid_amount` itself is a property over allocations, never a stored column,
    so the two cannot disagree.
    """
    if bill.status in {"DRAFT", "CANCELLED"}:
        return bill.status

    paid = bill.paid_amount
    total = bill.total_amount or Decimal("0.00")

    if total > 0 and paid >= total:
        status = "PAID"
    elif paid > 0:
        status = "PARTIALLY_PAID"
    else:
        status = "RECEIVED"

    if status != bill.status:
        bill.status = status
        bill.save(update_fields=["status", "updated_at"])

    return status


# ─── Payment out ──────────────────────────────────────────────────────────────

def guard_allocation_within_total(bill, incoming_amount, exclude_payment_id=None):
    """Invariant 7: sum(allocations) <= bill.total_amount."""
    already = (
        bill.allocations
        .exclude(payment_id=exclude_payment_id)
        .aggregate(total=Sum("amount"))
        .get("total")
        or Decimal("0.00")
    )

    if already + Decimal(str(incoming_amount)) > (bill.total_amount or Decimal("0.00")):
        raise ValidationError({
            "allocations": (
                f"Bill {bill.bill_number}: allocating {incoming_amount} would bring the total to "
                f"{already + Decimal(str(incoming_amount))} against a bill of {bill.total_amount}."
            )
        })


def supplier_outstanding(supplier=None):
    """Open payables per supplier — the report this module exists to enable."""
    bills = (
        Bill.objects
        .filter(status__in=Bill.OPEN_STATUSES)
        .select_related("supplier")
    )
    if supplier is not None:
        bills = bills.filter(supplier=supplier)

    rows = {}
    for bill in bills:
        row = rows.setdefault(bill.supplier_id, {
            "supplier_id": bill.supplier_id,
            "supplier_name": bill.supplier.name,
            "bill_count": 0,
            "total_billed": Decimal("0.00"),
            "total_paid": Decimal("0.00"),
            "outstanding": Decimal("0.00"),
        })
        row["bill_count"] += 1
        row["total_billed"] += bill.total_amount or Decimal("0.00")
        row["total_paid"] += bill.paid_amount
        row["outstanding"] += bill.balance_due

    return sorted(rows.values(), key=lambda r: r["outstanding"], reverse=True)
