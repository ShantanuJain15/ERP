"""Procure-to-pay tests.

These are the first tests in the project, and they deliberately target the
posting services rather than the HTTP layer: `services/purchase.py` is where
stock and money actually move, and a mistake there is invisible in the UI until
the stock figures have been wrong for a month.
"""

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from inventory.models import (
    Bill,
    BillLine,
    GoodsReceipt,
    GoodsReceiptLine,
    NumberSeries,
    POLineItem,
    PaymentOut,
    PaymentOutAllocation,
    Product,
    PurchaseOrder,
    StockMovement,
    Supplier,
    Warehouse,
    WarehouseStock,
)
from inventory.services import purchase as purchase_service
from inventory.services.numbering import (
    assign_document_number,
    next_document_number,
    peek_document_number,
)
from inventory.services.tax import compute_line_amounts, compute_line_tax


class PurchaseTestBase(TestCase):
    def setUp(self):
        self.supplier = Supplier.objects.create(
            name="Cool Air Distributors", state_code="09", payment_terms_days=30,
        )
        self.warehouse = Warehouse.objects.create(code="MAIN", name="Main Store", is_default=True)
        self.product = Product.objects.create(
            name="Split AC 1.5T", sku="AC-15T", price=Decimal("42000.00"),
        )

    def make_order(self, quantity=10, unit_price="30000.00"):
        order = PurchaseOrder.objects.create(
            po_number=next_document_number("PO"),
            supplier=self.supplier,
            warehouse=self.warehouse,
            status="SUBMITTED",
        )
        POLineItem.objects.create(
            purchase_order=order,
            product=self.product,
            quantity_ordered=quantity,
            unit_price=Decimal(unit_price),
        )
        return order

    def make_receipt(self, order=None, quantity=7, unit_cost="30000.00"):
        grn = GoodsReceipt.objects.create(
            grn_number=next_document_number("GRN"),
            purchase_order=order,
            supplier=self.supplier,
            warehouse=self.warehouse,
        )
        GoodsReceiptLine.objects.create(
            goods_receipt=grn,
            po_line_item=order.line_items.first() if order else None,
            product=self.product,
            quantity=quantity,
            unit_cost=Decimal(unit_cost),
        )
        return grn

    def stock_quantity(self):
        row = WarehouseStock.objects.filter(
            warehouse=self.warehouse, product=self.product,
        ).first()
        return row.quantity if row else 0

    def make_bill(self, updates_stock=False, warehouse=None, quantity=10, grn_line=None):
        bill = Bill.objects.create(
            bill_number=next_document_number("BILL"),
            supplier=self.supplier,
            warehouse=warehouse,
            updates_stock=updates_stock,
            place_of_supply="09",
        )
        BillLine.objects.create(
            bill=bill,
            goods_receipt_line=grn_line,
            product=self.product,
            quantity=quantity,
            unit_price=Decimal("30000.00"),
            gst_rate=Decimal("18.00"),
            taxable_amount=Decimal("30000.00") * quantity,
            cgst_amount=Decimal("0.00"),
            sgst_amount=Decimal("0.00"),
            igst_amount=Decimal("0.00"),
            line_total=Decimal("30000.00") * quantity,
        )
        bill.subtotal = Decimal("30000.00") * quantity
        bill.total_amount = bill.subtotal
        bill.save()
        return bill


class GoodsReceiptPostingTests(PurchaseTestBase):
    def test_confirming_posts_one_movement_per_line_and_raises_stock(self):
        order = self.make_order(quantity=10)
        grn = self.make_receipt(order, quantity=7, unit_cost="30000.00")

        purchase_service.confirm_goods_receipt(grn, performed_by="tester")

        movements = StockMovement.objects.filter(reference_number=grn.grn_number)
        self.assertEqual(movements.count(), 1)

        movement = movements.first()
        self.assertEqual(movement.movement_type, "IN")
        self.assertEqual(movement.reference_type, "GRN")
        self.assertEqual(movement.quantity_change, 7)
        # The ledger carries cost, which is what makes valuation a sum.
        self.assertEqual(movement.unit_cost, Decimal("30000.00"))
        self.assertEqual(movement.value_change, Decimal("210000.00"))

        self.assertEqual(self.stock_quantity(), 7)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 7)

    def test_cancelling_a_confirmed_receipt_compensates_rather_than_deletes(self):
        order = self.make_order(quantity=10)
        grn = self.make_receipt(order, quantity=7)
        purchase_service.confirm_goods_receipt(grn)
        self.assertEqual(self.stock_quantity(), 7)

        purchase_service.cancel_goods_receipt(grn)

        movements = StockMovement.objects.filter(reference_number=grn.grn_number).order_by("id")
        # The original row survives; a second, opposite row is appended.
        self.assertEqual(movements.count(), 2)
        self.assertEqual([m.movement_type for m in movements], ["IN", "OUT"])
        self.assertEqual([m.quantity_change for m in movements], [7, -7])

        self.assertEqual(self.stock_quantity(), 0)
        order.line_items.first().refresh_from_db()
        self.assertEqual(order.line_items.first().quantity_received, 0)

    def test_over_receipt_is_rejected(self):
        order = self.make_order(quantity=10)
        grn = self.make_receipt(order, quantity=12)

        with self.assertRaises(ValidationError):
            purchase_service.confirm_goods_receipt(grn)

        # Nothing posted, and the receipt stayed in DRAFT.
        grn.refresh_from_db()
        self.assertEqual(grn.status, "DRAFT")
        self.assertEqual(self.stock_quantity(), 0)

    def test_over_receipt_is_measured_across_receipts_not_just_this_one(self):
        """Three receipts of 4 against an order of 10 must fail on the third."""
        order = self.make_order(quantity=10)
        for _ in range(2):
            purchase_service.confirm_goods_receipt(self.make_receipt(order, quantity=4))

        third = self.make_receipt(order, quantity=4)
        with self.assertRaises(ValidationError):
            purchase_service.confirm_goods_receipt(third)

        self.assertEqual(self.stock_quantity(), 8)

    def test_partial_receipts_drive_order_status_and_derived_quantity(self):
        order = self.make_order(quantity=10)
        po_line = order.line_items.first()

        purchase_service.confirm_goods_receipt(self.make_receipt(order, quantity=7))
        order.refresh_from_db()
        po_line.refresh_from_db()
        self.assertEqual(order.status, "PARTIALLY_RECEIVED")
        self.assertEqual(po_line.quantity_received, 7)

        purchase_service.confirm_goods_receipt(
            self.make_receipt(order, quantity=3, unit_cost="31200.00")
        )
        order.refresh_from_db()
        po_line.refresh_from_db()
        self.assertEqual(order.status, "RECEIVED")
        self.assertEqual(po_line.quantity_received, 10)

        # quantity_received is derived: it equals the sum of the receipt lines.
        total = sum(
            line.quantity
            for line in GoodsReceiptLine.objects.filter(po_line_item=po_line)
        )
        self.assertEqual(po_line.quantity_received, total)

        # The price rise on the second delivery survives in the ledger, which is
        # the whole reason GoodsReceipt exists as a document.
        costs = sorted(
            StockMovement.objects.filter(reference_type="GRN").values_list("unit_cost", flat=True)
        )
        self.assertEqual(costs, [Decimal("30000.00"), Decimal("31200.00")])

    def test_receipt_without_a_purchase_order_still_posts_stock(self):
        grn = self.make_receipt(order=None, quantity=5)
        purchase_service.confirm_goods_receipt(grn)
        self.assertEqual(self.stock_quantity(), 5)


class PurchaseOrderGuardTests(PurchaseTestBase):
    def test_order_cannot_be_cancelled_once_goods_arrive(self):
        order = self.make_order(quantity=10)
        purchase_service.confirm_goods_receipt(self.make_receipt(order, quantity=7))
        order.refresh_from_db()

        with self.assertRaises(ValidationError):
            purchase_service.cancel_purchase_order(order)

        # Closing short is the correct move instead.
        purchase_service.close_purchase_order(order)
        order.refresh_from_db()
        self.assertEqual(order.status, "CLOSED")

    def test_empty_order_cannot_be_submitted(self):
        order = PurchaseOrder.objects.create(
            po_number=next_document_number("PO"),
            supplier=self.supplier,
            warehouse=self.warehouse,
        )
        with self.assertRaises(ValidationError):
            purchase_service.submit_purchase_order(order)


class TaxTests(TestCase):
    def test_intra_state_splits_evenly_and_never_emits_igst(self):
        cgst, sgst, igst = compute_line_tax(Decimal("10000.00"), Decimal("18.00"), intra_state=True)
        self.assertEqual(cgst, Decimal("900.00"))
        self.assertEqual(sgst, Decimal("900.00"))
        self.assertEqual(igst, Decimal("0.00"))
        self.assertEqual(cgst, sgst)

    def test_inter_state_emits_igst_only(self):
        cgst, sgst, igst = compute_line_tax(Decimal("10000.00"), Decimal("18.00"), intra_state=False)
        self.assertEqual(igst, Decimal("1800.00"))
        self.assertEqual(cgst, Decimal("0.00"))
        self.assertEqual(sgst, Decimal("0.00"))

    def test_halves_always_sum_back_to_the_total(self):
        """An odd number of paise must not drift when halved."""
        cgst, sgst, igst = compute_line_tax(Decimal("105.05"), Decimal("18.00"), intra_state=True)
        self.assertEqual(cgst + sgst + igst, Decimal("18.91"))

    def test_line_amounts_are_exclusive_of_tax(self):
        amounts = compute_line_amounts(
            quantity=2, unit_price=Decimal("30000.00"), gst_rate=Decimal("18.00"), intra_state=True,
        )
        self.assertEqual(amounts["taxable_amount"], Decimal("60000.00"))
        self.assertEqual(amounts["line_total"], Decimal("70800.00"))


class BillTests(PurchaseTestBase):
    def test_direct_bill_posts_stock_at_the_taxable_value(self):
        """No PO, no receipt — the bill is the receipt."""
        bill = self.make_bill(updates_stock=True, warehouse=self.warehouse, quantity=4)

        purchase_service.confirm_bill(bill, performed_by="tester")

        movements = StockMovement.objects.filter(reference_number=bill.bill_number)
        self.assertEqual(movements.count(), 1)

        movement = movements.first()
        self.assertEqual(movement.movement_type, "IN")
        self.assertEqual(movement.reference_type, "BILL")
        # GST-exclusive: input tax is reclaimable credit, not item cost.
        self.assertEqual(movement.unit_cost, Decimal("30000.00"))

        self.assertEqual(self.stock_quantity(), 4)

    def test_bill_linked_to_a_receipt_does_not_post_stock_again(self):
        order = self.make_order(quantity=10)
        grn = self.make_receipt(order, quantity=10)
        purchase_service.confirm_goods_receipt(grn)
        self.assertEqual(self.stock_quantity(), 10)

        bill = self.make_bill(
            updates_stock=False, quantity=10, grn_line=grn.lines.first(),
        )
        purchase_service.confirm_bill(bill)

        # Still 10 — the receipt moved it, the bill only created the payable.
        self.assertEqual(self.stock_quantity(), 10)
        self.assertFalse(StockMovement.objects.filter(reference_type="BILL").exists())

    def test_stock_posting_bill_carrying_a_receipt_line_is_rejected(self):
        """The double-count guard: both documents would move the same goods."""
        order = self.make_order(quantity=10)
        grn = self.make_receipt(order, quantity=10)
        purchase_service.confirm_goods_receipt(grn)

        bill = self.make_bill(
            updates_stock=True, warehouse=self.warehouse,
            quantity=10, grn_line=grn.lines.first(),
        )

        with self.assertRaises(ValidationError):
            purchase_service.confirm_bill(bill)

        self.assertEqual(self.stock_quantity(), 10)

    def test_stock_posting_bill_without_a_warehouse_is_rejected_by_the_database(self):
        """Invariant 11, enforced at the lowest level available.

        A bill that posts stock with nowhere to post it to is the exact shape of
        the sales-side Invoice bug, so this is a CheckConstraint rather than only
        a service guard — no code path can get around it.
        """
        with self.assertRaises(IntegrityError), transaction.atomic():
            Bill.objects.create(
                bill_number=next_document_number("BILL"),
                supplier=self.supplier,
                warehouse=None,
                updates_stock=True,
            )

    def test_service_also_guards_a_missing_warehouse(self):
        """The serializer and service catch it first, with a usable message."""
        bill = self.make_bill(updates_stock=False, warehouse=None, quantity=4)
        # Bypass the constraint the way a stale in-memory object would.
        bill.updates_stock = True

        with self.assertRaises(ValidationError):
            purchase_service.guard_stock_posting_bill(bill)

    def test_billing_more_than_was_received_is_rejected(self):
        order = self.make_order(quantity=10)
        grn = self.make_receipt(order, quantity=7)
        purchase_service.confirm_goods_receipt(grn)

        bill = self.make_bill(quantity=10, grn_line=grn.lines.first())
        with self.assertRaises(ValidationError):
            purchase_service.confirm_bill(bill)

    def test_cancelling_a_posted_bill_compensates(self):
        bill = self.make_bill(updates_stock=True, warehouse=self.warehouse, quantity=4)
        purchase_service.confirm_bill(bill)
        self.assertEqual(self.stock_quantity(), 4)

        purchase_service.cancel_bill(bill)

        movements = StockMovement.objects.filter(reference_number=bill.bill_number).order_by("id")
        self.assertEqual([m.movement_type for m in movements], ["IN", "OUT"])
        self.assertEqual(self.stock_quantity(), 0)

    def test_due_date_comes_from_supplier_payment_terms(self):
        bill = self.make_bill(updates_stock=True, warehouse=self.warehouse, quantity=1)
        purchase_service.confirm_bill(bill)
        bill.refresh_from_db()
        self.assertEqual((bill.due_date - bill.bill_date).days, 30)


class PaymentOutTests(PurchaseTestBase):
    def make_payment(self, bill, amount):
        payment = PaymentOut.objects.create(
            payment_number=next_document_number("PAYOUT"),
            supplier=self.supplier,
            amount=Decimal(amount),
        )
        PaymentOutAllocation.objects.create(payment=payment, bill=bill, amount=Decimal(amount))
        return payment

    def test_partial_payment_leaves_the_bill_partially_paid(self):
        bill = self.make_bill(updates_stock=True, warehouse=self.warehouse, quantity=1)
        purchase_service.confirm_bill(bill)

        self.make_payment(bill, "10000.00")
        purchase_service.sync_bill_payment_status(bill)
        bill.refresh_from_db()

        self.assertEqual(bill.status, "PARTIALLY_PAID")
        # paid_amount is derived from allocations, so it cannot disagree.
        self.assertEqual(bill.paid_amount, Decimal("10000.00"))
        self.assertEqual(bill.balance_due, Decimal("20000.00"))

    def test_settling_in_full_marks_the_bill_paid(self):
        bill = self.make_bill(updates_stock=True, warehouse=self.warehouse, quantity=1)
        purchase_service.confirm_bill(bill)

        self.make_payment(bill, "30000.00")
        purchase_service.sync_bill_payment_status(bill)
        bill.refresh_from_db()

        self.assertEqual(bill.status, "PAID")
        self.assertEqual(bill.balance_due, Decimal("0.00"))

    def test_over_allocation_is_rejected(self):
        bill = self.make_bill(updates_stock=True, warehouse=self.warehouse, quantity=1)
        purchase_service.confirm_bill(bill)
        self.make_payment(bill, "25000.00")

        with self.assertRaises(ValidationError):
            purchase_service.guard_allocation_within_total(bill, Decimal("10000.00"))

    def test_outstanding_report_totals_open_bills(self):
        bill = self.make_bill(updates_stock=True, warehouse=self.warehouse, quantity=1)
        purchase_service.confirm_bill(bill)
        self.make_payment(bill, "10000.00")
        purchase_service.sync_bill_payment_status(bill)

        rows = purchase_service.supplier_outstanding()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["outstanding"], Decimal("20000.00"))
        self.assertEqual(rows[0]["total_paid"], Decimal("10000.00"))


class NumberSeriesTests(PurchaseTestBase):
    def test_numbers_are_sequential_and_never_reused(self):
        numbers = [next_document_number("PO") for _ in range(3)]
        self.assertEqual(numbers, ["PO-00001", "PO-00002", "PO-00003"])
        self.assertEqual(len(set(numbers)), 3)

    def test_series_are_independent(self):
        self.assertEqual(next_document_number("PO"), "PO-00001")
        self.assertEqual(next_document_number("GRN"), "GRN-00001")
        self.assertEqual(next_document_number("BILL"), "BILL-00001")

    # ── Regressions ──────────────────────────────────────────────────────────
    # The forms peek the next number for display, then post that value straight
    # back. Treating the echo as a hand-typed number meant the series was never
    # consumed, so every new form offered PO-00001 and the second save collided.

    def test_posting_the_peeked_value_back_still_advances_the_series(self):
        first = peek_document_number("PO")
        self.assertEqual(assign_document_number("PO", first), "PO-00001")

        second = peek_document_number("PO")
        self.assertEqual(second, "PO-00002", "peek must move on once the value is used")
        self.assertEqual(assign_document_number("PO", second), "PO-00002")
        self.assertEqual(peek_document_number("PO"), "PO-00003")

    def test_blank_and_echoed_values_behave_identically(self):
        self.assertEqual(assign_document_number("PO", None), "PO-00001")
        self.assertEqual(assign_document_number("PO", ""), "PO-00002")
        self.assertEqual(assign_document_number("PO", "   "), "PO-00003")
        self.assertEqual(assign_document_number("PO", peek_document_number("PO")), "PO-00004")

    def test_a_new_series_seeds_past_documents_that_already_exist(self):
        """Deleting a series row does not delete its documents."""
        PurchaseOrder.objects.create(
            po_number="PO-00007", supplier=self.supplier, warehouse=self.warehouse,
        )
        NumberSeries.objects.all().delete()

        self.assertEqual(peek_document_number("PO"), "PO-00008")
        self.assertEqual(assign_document_number("PO", "PO-00008"), "PO-00008")

    def test_a_manual_override_pushes_the_series_beyond_it(self):
        self.assertEqual(assign_document_number("PO", "PO-00050"), "PO-00050")
        # The next auto-assignment must not hand back a number already taken.
        self.assertEqual(assign_document_number("PO", None), "PO-00051")

    def test_a_number_outside_the_series_format_is_kept_verbatim(self):
        self.assertEqual(assign_document_number("PO", "LEGACY/2024/9"), "LEGACY/2024/9")
        # An unrelated format must not disturb the sequence.
        self.assertEqual(assign_document_number("PO", None), "PO-00001")

    def test_an_override_below_the_cursor_does_not_rewind_the_series(self):
        assign_document_number("PO", None)   # PO-00001
        assign_document_number("PO", None)   # PO-00002
        assign_document_number("PO", "PO-00001")
        self.assertEqual(assign_document_number("PO", None), "PO-00003")

    def test_every_document_type_survives_a_round_trip_through_its_form(self):
        """The peek-then-echo cycle, for all four series."""
        for doc_type, expected in [
            ("PO", "PO-0000"), ("GRN", "GRN-0000"),
            ("BILL", "BILL-0000"), ("PAYOUT", "PAY-0000"),
        ]:
            with self.subTest(doc_type=doc_type):
                for n in (1, 2):
                    peeked = peek_document_number(doc_type)
                    self.assertEqual(peeked, f"{expected}{n}")
                    self.assertEqual(assign_document_number(doc_type, peeked), peeked)
