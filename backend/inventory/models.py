# from django.conf import settings
# from django.db import models
# from django.db.models import Q, CheckConstraint


# # Create your models here.


# class Product(models.Model): # it does not have pk  field, it will automatically create an id field as primary key
#     PRODUCT_TYPE = [
#         ("AC", "Air Conditioner"),
#         ("GENERIC", "Generic"),
#     ]
#     name = models.CharField(max_length=255)
#     type = models.CharField(max_length=20, choices=PRODUCT_TYPE)
#     sku = models.CharField(max_length=64, unique=True,blank=True)
#     brand = models.CharField(max_length=100)
#     description = models.TextField(blank=True)
#     price = models.DecimalField(max_digits=10, decimal_places=2)
#     quantity = models.PositiveIntegerField(default=0)
#     reorder_level = models.PositiveIntegerField(default=0)
#     is_active = models.BooleanField(default=True)
#     # last_modified_by = models.ForeignKey( settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,blank=True, related_name="modified_products")
#     last_modified_by_username = models.CharField(max_length=150, blank=True)  # Store the username for easier access
#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)

#     def __str__(self) -> str:
#         return f"{self.name} ({self.sku})"

   
# class AC(models.Model):
#     name = models.CharField(max_length=255)
#     model = models.CharField(max_length=100)
#     serial_number = models.CharField(max_length=100, unique=True)
#     # manufacture_period = models.DateField() # modify to month and year only
#     manufacture_month = models.PositiveSmallIntegerField(null=True,blank=True)
#     manufacture_year = models.PositiveSmallIntegerField(null=True,blank=True)
#     warranty_period = models.PositiveIntegerField(default=0)  # in months
#     is_active = models.BooleanField(default=True)
#     quantity = models.PositiveIntegerField(default=0)
#     tonnage = models.DecimalField(max_digits=5, decimal_places=2)  # e.g., 1.5 tons
#     wattage = models.PositiveIntegerField()  # e.g., 1500 watts
#     # description = models.TextField(blank=True)
#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)


#     class Meta:
#         constraints = [
#             CheckConstraint(
#                 condition=Q(manufacture_month__gte=1) & Q(manufacture_month__lte=12),
#                 name="month_between_1_12"
#             ),
#             CheckConstraint(
#                 condition=Q(manufacture_year__gt=2022) & Q(manufacture_year__lte=9999),
#                 name="year_valid_range"
#             ),
#         ]

#     def __str__(self) -> str:
#         return f"{self.name} ({self.serial_number})"
    
#     # @property
#     # def manufactured_period(self):
#     #     return f"{self.manufacture_month}/{self.manufacture_year}"




from decimal import Decimal

from django.db import models
from django.db.models import Q
from django.utils import timezone


# ─── Supplier ────────────────────────────────────────────────────────────────

class Supplier(models.Model):
    name           = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=150, blank=True)
    email          = models.EmailField(blank=True)
    phone          = models.CharField(max_length=30, blank=True)
    address        = models.TextField(blank=True)

    # GSTIN is 15 chars; its first two are the state code. `state_code` is kept
    # separately because a supplier may be unregistered (no GSTIN) and we still
    # need to know their state to pick CGST+SGST vs IGST.
    gstin      = models.CharField(max_length=15, blank=True)
    state_code = models.CharField(max_length=2, blank=True, help_text="GST state code, e.g. 27 for Maharashtra")

    payment_terms_days = models.PositiveIntegerField(
        default=30, help_text="Net payment days; sets the due date on a bill.",
    )

    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True

    def __str__(self):
        return self.name


# ─── Warehouse & stock location ───────────────────────────────────────────────

class Warehouse(models.Model):
    WAREHOUSE_TYPES = [
        ("MAIN", "Main"),
        ("BRANCH", "Branch"),
        ("STORE", "Store"),
        ("VIRTUAL", "Virtual"),
    ]

    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    warehouse_type = models.CharField(max_length=20, choices=WAREHOUSE_TYPES, default="MAIN")
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True

    def __str__(self):
        return self.name


class WarehouseStock(models.Model):
    """Current product quantity held by a warehouse."""
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="warehouse_stock")
    product = models.ForeignKey("Product", on_delete=models.CASCADE, related_name="warehouse_stock")
    quantity = models.IntegerField(default=0)
    reserved_quantity = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "inventory_warehousestock"
        unique_together = ("warehouse", "product")

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity

    def __str__(self):
        return f"{self.product.sku} @ {self.warehouse} ({self.quantity})"


# ─── Product ──────────────────────────────────────────────────────────────────

class Product(models.Model):
    PRODUCT_TYPE = [
        ("AC",      "Air Conditioner"),
        ("GENERIC", "Generic"),
    ]

    name           = models.CharField(max_length=255)
    type           = models.CharField(max_length=20, choices=PRODUCT_TYPE,blank=True,null=True)
    sku            = models.CharField(max_length=64, unique=True, blank=True)
    brand          = models.CharField(max_length=100,blank=True,null=True)
    description    = models.TextField(blank=True,null=True)
    price          = models.DecimalField(max_digits=10, decimal_places=2)

    # Aggregate quantity updated by the stock service from WarehouseStock totals.
    quantity       = models.IntegerField(default=0)
    reorder_level  = models.PositiveIntegerField(default=0)
    

    supplier       = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="products"
    )
    # Statutory classification. The rate on HSNCode is only a default — every
    # document line snapshots its own rate at save time.
    hsn_code       = models.ForeignKey(
        "HSNCode", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="products"
    )
    is_active      = models.BooleanField(default=True)
    last_modified_by_username = models.CharField(max_length=150, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.sku})"

    @property
    def needs_reorder(self):
        return self.quantity <= self.reorder_level


class ACProduct(models.Model):
    """Extra fields for Air Conditioner products (one-to-one extension)."""

    ENERGY_LABELS = [("A+++", "A+++"), ("A++", "A++"), ("A+", "A+"),
                     ("A", "A"), ("B", "B"), ("C", "C")]

    REFRIGERANT_CHOICES = [
        ("R32",   "R32"),
        ("R410A", "R410A"),
        ("R22",   "R22"),
        ("R290",  "R290 (Propane)"),
    ]

    product          = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="ac_details")
    tonnage          = models.DecimalField(max_digits=4, decimal_places=1, help_text="Cooling capacity in TR")
    star_rating      = models.PositiveSmallIntegerField(default=3, help_text="BEE star rating 1–5")
    energy_label     = models.CharField(max_length=10, choices=ENERGY_LABELS, blank=True)
    refrigerant_type = models.CharField(max_length=20, choices=REFRIGERANT_CHOICES, blank=True)

    class Meta:
        managed = True

    def __str__(self):
        return f"{self.product.sku} — {self.tonnage}TR ★{self.star_rating}"


# ─── Stock transaction log ────────────────────────────────────────────────────

class StockMovement(models.Model):
    MOVEMENT_TYPES = [
        ("IN",       "Stock in (purchase receipt)"),
        ("OUT",      "Stock out (sale dispatch)"),
        ("ADJ_UP",   "Manual adjustment — increase"),
        ("ADJ_DOWN", "Manual adjustment — decrease"),
        ("RETURN",   "Customer return"),
        ("DAMAGE",   "Damaged / write-off"),
    ]
    REFERENCE_TYPES = [
        ("PO", "Purchase Order"),
        ("GRN", "Goods Receipt"),
        ("BILL", "Bill"),
        ("SO", "Sales Order"),
        ("INVOICE", "Invoice"),
        ("MANUAL", "Manual"),
    ]

    movement_number = models.CharField(max_length=50, unique=True)
    product         = models.ForeignKey(Product,   on_delete=models.PROTECT, related_name="stock_movements")
    warehouse       = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_movements")
    movement_type   = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity        = models.PositiveIntegerField()
    quantity_change = models.IntegerField(help_text="Positive = in, negative = out")
    reference_type  = models.CharField(max_length=20, choices=REFERENCE_TYPES, default="MANUAL")
    reference_number = models.CharField(max_length=100, blank=True)

    # ── Valuation ─────────────────────────────────────────────────────────────
    # The ledger carries value alongside quantity, so stock valuation is a sum
    # over this table rather than a reconstruction from receipt documents. Both
    # are nullable: historical rows predate costing, and outward movements are
    # costed by the valuation method rather than by the document.
    unit_cost    = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text="GST-exclusive cost per unit. Input GST is reclaimable credit, not item cost.",
    )
    value_change = models.DecimalField(
        max_digits=16, decimal_places=2, null=True, blank=True,
        help_text="unit_cost x quantity_change. Signed, like quantity_change.",
    )

    notes           = models.TextField(blank=True)
    performed_by    = models.CharField(max_length=150, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "inventory_stockmovement"
        ordering = ["-created_at"]

    def __str__(self):
        sign = "+" if self.quantity_change >= 0 else ""
        return f"{self.movement_number} {self.movement_type} {sign}{self.quantity_change} x {self.product.sku}"


# ─── Purchase Orders ──────────────────────────────────────────────────────────

class PurchaseOrder(models.Model):
    # State machine: docs/domain/02-procure-to-pay.md
    #   DRAFT -> SUBMITTED -> PARTIALLY_RECEIVED -> RECEIVED -> CLOSED
    #   DRAFT/SUBMITTED -> CANCELLED (never once goods have arrived)
    # CLOSED is distinct from CANCELLED: the supplier ships 7 of 10 then
    # discontinues the model, so the order is neither complete nor cancelled.
    STATUS = [
        ("DRAFT",              "Draft"),
        ("SUBMITTED",          "Submitted"),
        ("PARTIALLY_RECEIVED", "Partially received"),
        ("RECEIVED",           "Fully received"),
        ("CLOSED",             "Closed short"),
        ("CANCELLED",          "Cancelled"),
    ]

    OPEN_STATUSES = {"SUBMITTED", "PARTIALLY_RECEIVED"}

    po_number     = models.CharField(max_length=50, unique=True)
    supplier      = models.ForeignKey(Supplier,  on_delete=models.PROTECT, related_name="purchase_orders")
    warehouse     = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="purchase_orders")
    status        = models.CharField(max_length=20, choices=STATUS, default="DRAFT")
    expected_date = models.DateField(null=True, blank=True)
    received_date = models.DateField(null=True, blank=True)
    notes         = models.TextField(blank=True)
    created_by    = models.CharField(max_length=150, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        ordering = ["-created_at"]

    def __str__(self):
        return f"PO {self.po_number} — {self.supplier}"

    @property
    def total_amount(self):
        return sum((line.line_total for line in self.line_items.all()), Decimal("0.00"))


class POLineItem(models.Model):
    purchase_order    = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="line_items")
    product           = models.ForeignKey(Product,       on_delete=models.PROTECT,  related_name="po_lines")
    quantity_ordered  = models.PositiveIntegerField()

    # A service-maintained cache of sum(goods_receipt_line.quantity) for this
    # line — the same pattern as WarehouseStock/Product.quantity. Nothing outside
    # services/purchase.py may write it; see sync_po_line_received().
    quantity_received = models.PositiveIntegerField(default=0)

    unit_price        = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = True
        unique_together = ("purchase_order", "product")

    @property
    def line_total(self):
        return self.quantity_ordered * self.unit_price

    @property
    def quantity_pending(self):
        return max(self.quantity_ordered - self.quantity_received, 0)

    def __str__(self):
        return f"{self.product.sku} × {self.quantity_ordered} on {self.purchase_order.po_number}"


# ─── Sales Orders ─────────────────────────────────────────────────────────────

class SalesOrder(models.Model):
    STATUS = [
        ("PENDING",   "Pending"),
        ("CONFIRMED", "Confirmed"),
        ("SHIPPED",   "Shipped"),
        ("DELIVERED", "Delivered"),
        ("CANCELLED", "Cancelled"),
        ("RETURNED",  "Returned"),
    ]

    so_number     = models.CharField(max_length=50, unique=True)
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=30, blank=True)
    warehouse     = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="sales_orders")
    status        = models.CharField(max_length=20, choices=STATUS, default="PENDING")
    order_date    = models.DateField(default=timezone.now)
    notes         = models.TextField(blank=True)
    created_by    = models.CharField(max_length=150, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True

    def __str__(self):
        return f"SO {self.so_number} — {self.customer_name}"


class SOLineItem(models.Model):
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="line_items")
    product     = models.ForeignKey(Product,    on_delete=models.PROTECT,  related_name="so_lines")
    quantity    = models.PositiveIntegerField()
    unit_price  = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = True
        unique_together = ("sales_order", "product")

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.product.sku} × {self.quantity} on {self.sales_order.so_number}"
    


class Customer(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20,null=True,unique=True)
    email = models.EmailField(unique=True,null=True)
    address = models.TextField(null=True,blank=True)

    is_active      = models.BooleanField(default=True)
    last_modified_by_username = models.CharField(max_length=150, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)
    
    class Meta:
        managed = True

    def __str__(self):
        return self.name
    
class Invoice(models.Model):

    invoice_number = models.CharField(max_length=50)  # uniqueness via unique_together below
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT)
    date = models.DateTimeField(auto_now_add=True)
    # invoice_items=
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    status = models.CharField(
        max_length=20,
        choices=[
            ("PENDING", "Pending"),
            ("PAID", "Paid"),
            ("PARTIAL", "Partial"),
            ("DRAFT", "Draft"),
        ],
        default="DRAFT"
    )

    # ── Versioning ────────────────────────────────────────────────────────────
    version = models.PositiveIntegerField(default=1)
    parent  = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='revisions',
        help_text="Previous version of this invoice",
    )

    is_active      = models.BooleanField(default=True)
    last_modified_by_username = models.CharField(max_length=150, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['invoice_number', 'version']]

    class Meta:
        managed = True

    def __str__(self):
        return self.invoice_number
    
    def update_total(self):
        total = sum(item.total for item in self.items.all())
        self.total_amount = total
        self.save()
        

class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items") # what is related_names: it is related to serializer
    product = models.ForeignKey(Product, on_delete=models.CASCADE)

    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, default="", help_text="Optional line item description")

    total = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = True

    def save(self, *args, **kwargs):
        if not self.pk and self.invoice.status != "DRAFT":  # only deduct stock for non-draft invoices
            self.product.quantity -= self.quantity
            self.product.save()

        self.total = self.quantity * self.price
        super().save(*args, **kwargs)


# ─── Cross-cutting: document numbering & tax classification ───────────────────

class NumberSeries(models.Model):
    """One row per document type, incremented under a row lock.

    Replaces the "scan for the max, then +1" numbering used elsewhere in this
    app, which races: two concurrent creates read the same maximum and take the
    same number.

    NOTE: select_for_update() is a silent no-op on SQLite, which is the DB this
    project currently runs on. The lock only becomes real on MySQL/Postgres.
    """

    DOCUMENT_TYPES = [
        ("PO",     "Purchase Order"),
        ("GRN",    "Goods Receipt"),
        ("BILL",   "Bill"),
        ("PAYOUT", "Payment Out"),
    ]

    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES, unique=True)
    prefix        = models.CharField(max_length=20)
    next_number   = models.PositiveIntegerField(default=1)
    padding       = models.PositiveSmallIntegerField(default=5)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        verbose_name_plural = "number series"

    def __str__(self):
        return f"{self.document_type} → {self.prefix}{self.next_number:0{self.padding}d}"


class HSNCode(models.Model):
    """Statutory product classification, printed on every GST document.

    `gst_rate` here is a *default* only. Documents snapshot their own rate at
    save time, because rates change and an issued document must keep the tax it
    was actually raised with.
    """

    code        = models.CharField(max_length=10, unique=True)
    description = models.CharField(max_length=255, blank=True)
    gst_rate    = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        ordering = ["code"]
        verbose_name = "HSN code"

    def __str__(self):
        return f"{self.code} ({self.gst_rate}%)"


# ─── Goods Receipt (UI name: "Purchase Receive") ──────────────────────────────

class GoodsReceipt(models.Model):
    """Goods physically arriving from a supplier. This is what moves stock in.

    Confirming one posts stock through services/stock.record_stock_movement();
    cancelling a confirmed one writes compensating movements rather than
    deleting, because the stock ledger is append-only.
    """

    STATUS = [
        ("DRAFT",     "Draft"),
        ("RECEIVED",  "Received"),
        ("CANCELLED", "Cancelled"),
    ]

    grn_number = models.CharField(max_length=50, unique=True)

    # Nullable: emergency and cash purchases arrive without a purchase order.
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.PROTECT,
        null=True, blank=True, related_name="goods_receipts",
    )
    supplier  = models.ForeignKey(Supplier,  on_delete=models.PROTECT, related_name="goods_receipts")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="goods_receipts")

    status        = models.CharField(max_length=20, choices=STATUS, default="DRAFT")
    # localdate, not now: a DateField default must yield a date, and DRF refuses
    # to coerce a datetime rather than silently drop the timezone.
    received_date = models.DateField(default=timezone.localdate)

    supplier_dc_number = models.CharField(
        max_length=100, blank=True, help_text="The supplier's own delivery challan number",
    )
    notes      = models.TextField(blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        ordering = ["-received_date", "-id"]

    def __str__(self):
        return f"GRN {self.grn_number} — {self.supplier}"

    @property
    def total_cost(self):
        return sum((line.line_cost for line in self.lines.all()), Decimal("0.00"))


class GoodsReceiptLine(models.Model):
    goods_receipt = models.ForeignKey(GoodsReceipt, on_delete=models.CASCADE, related_name="lines")

    # Nullable for the same reason the header's purchase_order is.
    po_line_item = models.ForeignKey(
        POLineItem, on_delete=models.PROTECT,
        null=True, blank=True, related_name="receipt_lines",
    )
    product  = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="grn_lines")
    quantity = models.PositiveIntegerField()

    # The single most valuable column in this module: without it, stock
    # valuation, COGS and margin are all uncomputable. GST-exclusive.
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        managed = True

    @property
    def line_cost(self):
        return self.quantity * self.unit_cost

    def __str__(self):
        return f"{self.product.sku} × {self.quantity} on {self.goods_receipt.grn_number}"


# ─── Bill (supplier's purchase invoice) ───────────────────────────────────────

class Bill(models.Model):
    """The supplier's demand for payment. Creates a payable.

    Three paths reach stock (docs/domain/02-procure-to-pay.md):
      PO -> GRN -> Bill    the GRN posts stock
      GRN -> Bill          the GRN posts stock (no order was raised)
      Bill only            *this document* posts stock — a cash/counter buy

    `updates_stock` picks which. Without it stock is either double-counted or
    never moved, depending on which document you trust.
    """

    STATUS = [
        ("DRAFT",          "Draft"),
        ("RECEIVED",       "Received"),
        ("PARTIALLY_PAID", "Partially paid"),
        ("PAID",           "Paid"),
        ("CANCELLED",      "Cancelled"),
    ]

    OPEN_STATUSES = {"RECEIVED", "PARTIALLY_PAID"}

    bill_number = models.CharField(max_length=50, unique=True)

    # The supplier's own number, from the document they sent us. Unique per
    # supplier, not globally — two suppliers may both use "INV-001".
    supplier_bill_number = models.CharField(max_length=100, blank=True)
    supplier_bill_date   = models.DateField(null=True, blank=True)

    supplier       = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="bills")
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.PROTECT,
        null=True, blank=True, related_name="bills",
    )

    # Required when updates_stock is true — this is where the goods land.
    # Its absence on the sales-side Invoice is what forces that code to reach
    # around the stock service; do not repeat it here.
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT,
        null=True, blank=True, related_name="bills",
    )
    updates_stock = models.BooleanField(
        default=False,
        help_text="True when this bill IS the receipt (no GRN was made).",
    )

    status    = models.CharField(max_length=20, choices=STATUS, default="DRAFT")
    bill_date = models.DateField(default=timezone.localdate)
    due_date  = models.DateField(null=True, blank=True)

    place_of_supply = models.CharField(
        max_length=2, blank=True, help_text="State code; decides CGST+SGST vs IGST",
    )

    # Stored, never recomputed on read: a historical document must show the
    # figures it was actually raised with.
    subtotal        = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_total       = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_amount    = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    notes      = models.TextField(blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        ordering = ["-bill_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["supplier", "supplier_bill_number"],
                condition=~Q(supplier_bill_number=""),
                name="unique_supplier_bill_number_per_supplier",
            ),
            models.CheckConstraint(
                condition=Q(updates_stock=False) | Q(warehouse__isnull=False),
                name="bill_updates_stock_requires_warehouse",
            ),
        ]

    def __str__(self):
        return f"Bill {self.bill_number} — {self.supplier}"

    @property
    def paid_amount(self):
        """Derived from allocations — never stored, so it cannot disagree."""
        total = self.allocations.aggregate(total=models.Sum("amount")).get("total")
        return total or Decimal("0.00")

    @property
    def balance_due(self):
        return self.total_amount - self.paid_amount


class BillLine(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name="lines")

    # Links the bill back to what actually arrived, which is what makes the
    # "billed <= received" guard checkable. Null on the direct-bill path.
    goods_receipt_line = models.ForeignKey(
        GoodsReceiptLine, on_delete=models.PROTECT,
        null=True, blank=True, related_name="bill_lines",
    )
    product    = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="bill_lines")
    quantity   = models.PositiveIntegerField()
    unit_price = models.DecimalField(
        max_digits=14, decimal_places=2, help_text="GST-exclusive; tax is added on top.",
    )

    # ── Tax, snapshotted at save ──────────────────────────────────────────────
    # GST lives on the line because rates differ per product and GST returns
    # need an HSN-wise breakup — an invoice-level tax field cannot work.
    hsn_code       = models.CharField(max_length=10, blank=True)
    gst_rate       = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    taxable_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    cgst_amount    = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    sgst_amount    = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    igst_amount    = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    line_total     = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        managed = True

    def __str__(self):
        return f"{self.product.sku} × {self.quantity} on {self.bill.bill_number}"


# ─── Payment Out ──────────────────────────────────────────────────────────────

class PaymentOut(models.Model):
    """Money paid to a supplier.

    One payment can settle several bills and one bill can take several
    payments, so the link is many-to-many through PaymentOutAllocation, which
    carries the amount. That is what replaces a scalar paid_amount.
    """

    METHODS = [
        ("CASH",   "Cash"),
        ("UPI",    "UPI"),
        ("NEFT",   "NEFT / RTGS"),
        ("CHEQUE", "Cheque"),
        ("CARD",   "Card"),
    ]
    STATUS = [
        ("PENDING", "Pending"),
        ("PAID",    "Paid"),
        ("FAILED",  "Failed"),
    ]

    payment_number = models.CharField(max_length=50, unique=True)
    supplier  = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="payments_out")
    amount    = models.DecimalField(max_digits=14, decimal_places=2)
    method    = models.CharField(max_length=20, choices=METHODS, default="NEFT")
    status    = models.CharField(max_length=20, choices=STATUS, default="PAID")
    paid_date = models.DateField(default=timezone.localdate)
    reference = models.CharField(
        max_length=150, blank=True, help_text="UTR / cheque number / transaction id",
    )
    notes      = models.TextField(blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        ordering = ["-paid_date", "-id"]

    def __str__(self):
        return f"{self.payment_number} — {self.supplier} {self.amount}"

    @property
    def allocated_amount(self):
        total = self.allocations.aggregate(total=models.Sum("amount")).get("total")
        return total or Decimal("0.00")

    @property
    def unallocated_amount(self):
        return self.amount - self.allocated_amount


class PaymentOutAllocation(models.Model):
    payment = models.ForeignKey(PaymentOut, on_delete=models.CASCADE, related_name="allocations")
    bill    = models.ForeignKey(Bill,       on_delete=models.PROTECT, related_name="allocations")
    amount  = models.DecimalField(max_digits=14, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        unique_together = ("payment", "bill")

    def __str__(self):
        return f"{self.payment.payment_number} → {self.bill.bill_number} {self.amount}"
