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




from reportlab.lib.colors import black
from django.db import models
from django.conf import settings
from django.utils import timezone


# ─── Supplier ────────────────────────────────────────────────────────────────

class Supplier(models.Model):
    name           = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=150, blank=True)
    email          = models.EmailField(blank=True)
    phone          = models.CharField(max_length=30, blank=True)
    address        = models.TextField(blank=True)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ─── Warehouse & stock location ───────────────────────────────────────────────

class Warehouse(models.Model):
    name      = models.CharField(max_length=255)
    address   = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class StockLocation(models.Model):
    """Tracks how many units of a product sit in a specific warehouse bin."""
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stock_locations")
    product   = models.ForeignKey("Product",  on_delete=models.CASCADE, related_name="stock_locations")
    bin_code  = models.CharField(max_length=50, blank=True, help_text="Aisle/shelf/bin reference")
    quantity  = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("warehouse", "product", "bin_code")

    def __str__(self):
        return f"{self.product.sku} @ {self.warehouse} ({self.bin_code or 'default'})"


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

    # Aggregate quantity — updated by signals/service layer when StockTransaction is saved
    quantity       = models.PositiveIntegerField(default=0)
    reorder_level  = models.PositiveIntegerField(default=0)
    

    supplier       = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="products"
    )
    is_active      = models.BooleanField(default=True)
    last_modified_by_username = models.CharField(max_length=150, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
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

    def __str__(self):
        return f"{self.product.sku} — {self.tonnage}TR ★{self.star_rating}"


# ─── Stock transaction log ────────────────────────────────────────────────────

class StockTransaction(models.Model):
    TXN_TYPES = [
        ("IN",       "Stock in (purchase receipt)"),
        ("OUT",      "Stock out (sale dispatch)"),
        ("ADJ_UP",   "Manual adjustment — increase"),
        ("ADJ_DOWN", "Manual adjustment — decrease"),
        ("TRANSFER", "Warehouse transfer"),
        ("RETURN",   "Customer return"),
        ("DAMAGE",   "Damaged / write-off"),
    ]

    product         = models.ForeignKey(Product,   on_delete=models.PROTECT, related_name="stock_transactions")
    warehouse       = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_transactions")
    txn_type        = models.CharField(max_length=20, choices=TXN_TYPES)
    quantity_change = models.IntegerField(help_text="Positive = in, negative = out")
    # Loose reference so any PO/SO number can be stored without a hard FK
    reference       = models.CharField(max_length=100, blank=True, help_text="PO/SO number or note")
    performed_by    = models.CharField(max_length=150, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        sign = "+" if self.quantity_change >= 0 else ""
        return f"{self.txn_type} {sign}{self.quantity_change} × {self.product.sku}"


# ─── Purchase Orders ──────────────────────────────────────────────────────────

class PurchaseOrder(models.Model):
    STATUS = [
        ("DRAFT",     "Draft"),
        ("CONFIRMED", "Confirmed"),
        ("RECEIVED",  "Fully received"),
        ("PARTIAL",   "Partially received"),
        ("CANCELLED", "Cancelled"),
    ]

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

    def __str__(self):
        return f"PO {self.po_number} — {self.supplier}"


class POLineItem(models.Model):
    purchase_order    = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="line_items")
    product           = models.ForeignKey(Product,       on_delete=models.PROTECT,  related_name="po_lines")
    quantity_ordered  = models.PositiveIntegerField()
    quantity_received = models.PositiveIntegerField(default=0)
    unit_price        = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ("purchase_order", "product")

    @property
    def line_total(self):
        return self.quantity_ordered * self.unit_price

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

    def __str__(self):
        return f"SO {self.so_number} — {self.customer_name}"


class SOLineItem(models.Model):
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="line_items")
    product     = models.ForeignKey(Product,    on_delete=models.PROTECT,  related_name="so_lines")
    quantity    = models.PositiveIntegerField()
    unit_price  = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
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
    
    def __str__(self):
        return self.name
    
class Invoice(models.Model):

    invoice_number = models.CharField(max_length=50, unique=True)
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
        ],
        default="PENDING"
    )

    is_active      = models.BooleanField(default=True)
    last_modified_by_username = models.CharField(max_length=150, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

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

    total = models.DecimalField(max_digits=10, decimal_places=2)

    def save(self, *args, **kwargs):
        if not self.pk:  # only when creating
            self.product.quantity -= self.quantity
            self.product.save()

        self.total = self.quantity * self.price
        super().save(*args, **kwargs)