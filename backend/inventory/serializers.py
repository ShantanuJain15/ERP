import decimal
import re

from django.db import transaction
from rest_framework import serializers

from .models import (
    ACProduct,
    Bill,
    BillLine,
    Customer,
    GoodsReceipt,
    GoodsReceiptLine,
    HSNCode,
    Invoice,
    InvoiceItem,
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
from .services import purchase as purchase_service
from .services.numbering import assign_document_number
from .services.stock import record_stock_movement
from .services.tax import compute_line_amounts, is_intra_state


class SupplierSerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "contact_person",
            "email",
            "phone",
            "address",
            "gstin",
            "state_code",
            "payment_terms_days",
            "is_active",
            "created_at",
            "products_count",
        ]

    def get_products_count(self, obj):
        return obj.products.count()


class ACProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = ACProduct
        fields = ["tonnage", "star_rating", "energy_label", "refrigerant_type"]


class ProductSerializer(serializers.ModelSerializer):
    # last_modified_by = serializers.ReadOnlyField() # It not work since it is a foreign key(), (TypeError: Object of type User is not JSON serializable,)
    last_modified_by_username= serializers.ReadOnlyField() # Since this field is addded by perform_create, it will not be passed by the client, so it is read only fiel
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default=None)
    updated_at = serializers.ReadOnlyField()
    created_at = serializers.ReadOnlyField()
    ac_details = ACProductSerializer(required=False, allow_null=True)

    class Meta:
        model = Product
        fields = "__all__"
        read_only_fields = ["quantity", "last_modified_by_username", "created_at", "updated_at"]

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")

        if request and not request.user.is_staff:
            fields.pop("last_modified_by", None)
            fields.pop("last_modified_by_username", None)
            fields.pop("updated_at", None)
            fields.pop("created_at", None)
        return fields

    def create(self, validated_data):
        ac_data = validated_data.pop("ac_details", None)
        validated_data["quantity"] = 0
        if not (validated_data.get("sku") or "").strip():
            validated_data["sku"] = self._next_sku(validated_data.get("name", ""))
        product = Product.objects.create(**validated_data)

        if product.type == "AC" and ac_data:
            ACProduct.objects.create(product=product, **ac_data)

        return product

    def update(self, instance, validated_data):
        ac_data = validated_data.pop("ac_details", None)
        if "sku" in validated_data and not (validated_data.get("sku") or "").strip():
            validated_data["sku"] = self._next_sku(
                validated_data.get("name", instance.name),
                exclude_pk=instance.pk,
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Handle AC details
        if instance.type == "AC" and ac_data:
            ac_obj, created = ACProduct.objects.get_or_create(
                product=instance,
                defaults=ac_data,
            )
            if not created:
                for attr, value in ac_data.items():
                    setattr(ac_obj, attr, value)
                ac_obj.save()
        elif instance.type != "AC":
            # If type changed away from AC, remove the ac details
            ACProduct.objects.filter(product=instance).delete()

        return instance

    def validate(self, attrs):
        if "quantity" in getattr(self, "initial_data", {}):
            raise serializers.ValidationError({
                "quantity": "Use stock movements to change quantity."
            })
        return attrs

    @staticmethod
    def _next_sku(name, exclude_pk=None):
        base = re.sub(r"[^A-Za-z0-9]+", "-", name or "").strip("-").upper()
        base = (base or "PRODUCT")[:40]

        queryset = Product.objects.all()
        if exclude_pk:
            queryset = queryset.exclude(pk=exclude_pk)

        if not queryset.filter(sku=base).exists():
            return base

        for sequence in range(1, 10000):
            sku = f"{base}-{sequence:03d}"
            if len(sku) > Product._meta.get_field("sku").max_length:
                suffix = f"-{sequence:03d}"
                sku = f"{base[:Product._meta.get_field('sku').max_length - len(suffix)]}{suffix}"
            if not queryset.filter(sku=sku).exists():
                return sku

        raise serializers.ValidationError({"sku": "Could not generate a unique SKU."})


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = "__all__"


class WarehouseStockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    available_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = WarehouseStock
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "product",
            "product_name",
            "product_sku",
            "quantity",
            "reserved_quantity",
            "available_quantity",
            "updated_at",
        ]
        read_only_fields = ["quantity", "reserved_quantity", "available_quantity", "updated_at"]


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "movement_number",
            "warehouse",
            "warehouse_name",
            "product",
            "product_name",
            "product_sku",
            "movement_type",
            "quantity",
            "quantity_change",
            "reference_type",
            "reference_number",
            # Valuation: written by the posting services, never by a client.
            "unit_cost",
            "value_change",
            "notes",
            "performed_by",
            "created_at",
        ]
        read_only_fields = [
            "movement_number", "quantity_change", "unit_cost", "value_change",
            "performed_by", "created_at",
        ]

    def validate(self, attrs):
        if self.instance:
            return attrs

        quantity = attrs.get("quantity")
        movement_type = attrs.get("movement_type")

        if quantity is None:
            raise serializers.ValidationError({"quantity": "Quantity is required."})
        if quantity <= 0:
            raise serializers.ValidationError({"quantity": "Quantity must be greater than zero."})
        if not movement_type:
            raise serializers.ValidationError({"movement_type": "Movement type is required."})

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        performed_by = validated_data.get("performed_by", "")
        if request and request.user and request.user.is_authenticated:
            performed_by = request.user.username

        return record_stock_movement(
            warehouse=validated_data["warehouse"],
            product=validated_data["product"],
            movement_type=validated_data["movement_type"],
            quantity=validated_data["quantity"],
            reference_type=validated_data.get("reference_type", "MANUAL"),
            reference_number=validated_data.get("reference_number", ""),
            notes=validated_data.get("notes", ""),
            performed_by=performed_by,
        )


# class ACSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = AC
#         fields = "__all__"


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = "__all__"



class InvoiceItemSerializer(serializers.ModelSerializer):
    # Denormalised product info so the invoice document can be rendered
    # without a second round-trip per line item.
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku  = serializers.CharField(source="product.sku",  read_only=True)

    class Meta:
        model = InvoiceItem
        fields = "__all__"
        # 'invoice' is set automatically in InvoiceSerializer.create()
        # so we mark it read_only to skip DRF's required-field validation.
        # 'total' is computed on save so it's also read_only.
        read_only_fields = ["invoice", "total"]

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)
    last_modified_by_username = serializers.ReadOnlyField()
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    # Full customer record (address/phone/email) for the Bill To block on the
    # invoice document. 'customer' itself stays a writable PK.
    customer_detail = CustomerSerializer(source="customer", read_only=True)
    invoice_number = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = ["total_amount", "version", "is_active", "parent"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Keep customer id in response (edit form needs it)
        return data

    # ── INVOICE NUMBER VALIDATION & AUTO-GENERATION ──────────────────────────
    _INVOICE_RE = re.compile(r"^PFE00\d{3}$")

    def validate_invoice_number(self, value):
        """If provided, must match PFE00XXX (e.g. PFE00001)."""
        if value and not self._INVOICE_RE.match(value):
            raise serializers.ValidationError(
                "Invoice number must follow the format PFE00XXX "
                "(e.g. PFE00001). 'PFE00' prefix + exactly 3 digits."
            )
        return value
    
    @staticmethod
    def _next_invoice_number():
        """Return the next sequential invoice number like PFE00001."""
        last = (
            Invoice.objects
            .filter(invoice_number__regex=r"^PFE00\d{3}$")
            .order_by("-invoice_number")
            .values_list("invoice_number", flat=True)
            .first()
        )
        next_seq = int(last[-3:]) + 1 if last else 1
        if next_seq > 999:
            raise serializers.ValidationError(
                "Invoice number sequence exhausted (PFE00999 reached)."
            )
        return f"PFE00{next_seq:03d}"

    # ── CREATE ────────────────────────────────────────────────────────────────
    def create(self, validated_data):
        # Auto-assign next invoice number if not provided
        if not validated_data.get("invoice_number"):
            validated_data["invoice_number"] = self._next_invoice_number()

        is_draft = validated_data.get("status") == "DRAFT"
        items_data = validated_data.pop("items", [])

        if not items_data and not is_draft:
            raise serializers.ValidationError({
                "items": "Invoice must have at least one item"
            })

        invoice = Invoice.objects.create(**validated_data)

        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)

        invoice.update_total()
        self._sync_status(invoice)
        invoice.save()
        return invoice

    # ── UPDATE — version-based (deactivate old → create new version) ────────
    @transaction.atomic
    def update(self, instance, validated_data):
        import decimal

        items_data = validated_data.pop("items", None)

        # ── 1. Deactivate the current version ─────────────────────────────────
        instance.is_active = False
        instance.save(update_fields=["is_active"])

        # ── 2. Restore stock for old items (they belong to the old version) ───
        old_items = list(instance.items.select_related("product").all())
        if instance.status != "DRAFT":
            for old_item in old_items:
                old_item.product.quantity += old_item.quantity
                old_item.product.save(update_fields=["quantity"])

        # ── 3. Build new invoice data ─────────────────────────────────────────
        new_invoice_data = {
            "invoice_number":           instance.invoice_number,
            "customer":                 validated_data.get("customer", instance.customer),
            "paid_amount":              validated_data.get("paid_amount", instance.paid_amount),
            "status":                   validated_data.get("status", instance.status),
            "version":                  instance.version + 1,
            "parent":                   instance,
            "is_active":                True,
            "last_modified_by_username": validated_data.get(
                "last_modified_by_username",
                instance.last_modified_by_username,
            ),
        }

        new_invoice = Invoice.objects.create(**new_invoice_data)

        # ── 4. Create items on the new version ────────────────────────────────
        if items_data is not None:
            # Use the incoming items payload
            for d in items_data:
                InvoiceItem.objects.create(
                    invoice=new_invoice,
                    product=d["product"],
                    quantity=int(d["quantity"]),
                    price=decimal.Decimal(str(d["price"])),
                    description=d.get("description", ""),
                )
        else:
            # No items change — clone existing items to the new version
            for old_item in old_items:
                InvoiceItem.objects.create(
                    invoice=new_invoice,
                    product=old_item.product,
                    quantity=old_item.quantity,
                    price=old_item.price,
                    description=old_item.description,
                )

        # ── 5. Recalculate total and sync status ─────────────────────────────
        new_invoice.update_total()

        explicit_status = "status" in validated_data
        if not explicit_status:
            self._sync_status(new_invoice)
            new_invoice.save(update_fields=["status"])

        return new_invoice



    # ── HELPER ────────────────────────────────────────────────────────────────
    @staticmethod
    def _sync_status(invoice):
        """Set status automatically based on paid_amount vs total_amount.
        Preserves DRAFT status — only auto-syncs non-draft invoices."""
        if invoice.status == "DRAFT":
            return
        paid  = invoice.paid_amount  or 0
        total = invoice.total_amount or 0
        if total > 0 and paid >= total:
            invoice.status = "PAID"
        elif paid > 0:
            invoice.status = "PARTIAL"
        else:
            invoice.status = "PENDING"


# ══════════════════════════════════════════════════════════════════════════════
# PROCURE TO PAY
#
# Header/lines pattern follows InvoiceSerializer, but deliberately NOT its
# update(): that versions by copy (deactivate old, create a v+1 row), so the PK
# changes on every edit. Purchase documents use status guards instead — editable
# while DRAFT, frozen once confirmed.
# ══════════════════════════════════════════════════════════════════════════════


class HSNCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HSNCode
        fields = ["id", "code", "description", "gst_rate", "is_active", "created_at"]


class _DraftOnlyMixin:
    """Refuse edits to a document that has left DRAFT.

    ERPs do not edit posted documents; they cancel and re-raise them. Without
    this guard a PATCH could silently rewrite a receipt that has already moved
    stock, leaving the ledger describing something that no longer exists.
    """

    editable_statuses = {"DRAFT"}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.status not in self.editable_statuses:
            raise serializers.ValidationError({
                "status": f"A {self.instance.status} document cannot be edited. Cancel it instead."
            })
        return attrs


# ─── Purchase order ───────────────────────────────────────────────────────────

class POLineItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku  = serializers.CharField(source="product.sku",  read_only=True)
    line_total   = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    quantity_pending = serializers.IntegerField(read_only=True)

    class Meta:
        model = POLineItem
        fields = [
            "id", "product", "product_name", "product_sku",
            "quantity_ordered", "quantity_received", "quantity_pending",
            "unit_price", "line_total",
        ]
        # quantity_received is a service-maintained cache of the receipt lines.
        read_only_fields = ["quantity_received"]


class PurchaseOrderSerializer(_DraftOnlyMixin, serializers.ModelSerializer):
    line_items      = POLineItemSerializer(many=True)
    supplier_name   = serializers.CharField(source="supplier.name",  read_only=True)
    warehouse_name  = serializers.CharField(source="warehouse.name", read_only=True)
    supplier_detail = SupplierSerializer(source="supplier", read_only=True)
    total_amount    = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    po_number       = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id", "po_number", "supplier", "supplier_name", "supplier_detail",
            "warehouse", "warehouse_name", "status", "expected_date", "received_date",
            "notes", "created_by", "created_at", "updated_at",
            "line_items", "total_amount",
        ]
        read_only_fields = ["status", "received_date", "created_by", "created_at", "updated_at"]

    def validate_line_items(self, value):
        if not value:
            raise serializers.ValidationError("A purchase order must have at least one line.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("line_items", [])
        validated_data["po_number"] = assign_document_number("PO", validated_data.get("po_number"))

        purchase_order = PurchaseOrder.objects.create(**validated_data)
        for line in lines:
            POLineItem.objects.create(purchase_order=purchase_order, **line)

        return purchase_order

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("line_items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Replace lines wholesale: they carry no posted state while DRAFT, and
        # diffing them would be more code for no behavioural gain.
        if lines is not None:
            instance.line_items.all().delete()
            for line in lines:
                POLineItem.objects.create(purchase_order=instance, **line)

        return instance


# ─── Goods receipt ────────────────────────────────────────────────────────────

class GoodsReceiptLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku  = serializers.CharField(source="product.sku",  read_only=True)
    line_cost    = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)

    class Meta:
        model = GoodsReceiptLine
        fields = [
            "id", "po_line_item", "product", "product_name", "product_sku",
            "quantity", "unit_cost", "line_cost",
        ]


class GoodsReceiptSerializer(_DraftOnlyMixin, serializers.ModelSerializer):
    lines           = GoodsReceiptLineSerializer(many=True)
    supplier_name   = serializers.CharField(source="supplier.name",  read_only=True)
    warehouse_name  = serializers.CharField(source="warehouse.name", read_only=True)
    supplier_detail = SupplierSerializer(source="supplier", read_only=True)
    po_number       = serializers.CharField(source="purchase_order.po_number", read_only=True, default=None)
    total_cost      = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    grn_number      = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = GoodsReceipt
        fields = [
            "id", "grn_number", "purchase_order", "po_number",
            "supplier", "supplier_name", "supplier_detail",
            "warehouse", "warehouse_name", "status", "received_date",
            "supplier_dc_number", "notes", "created_by", "created_at", "updated_at",
            "lines", "total_cost",
        ]
        read_only_fields = ["status", "created_by", "created_at", "updated_at"]

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("A goods receipt must have at least one line.")
        for line in value:
            if line.get("unit_cost") is None:
                raise serializers.ValidationError("Every receipt line needs a unit cost.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines", [])
        validated_data["grn_number"] = assign_document_number("GRN", validated_data.get("grn_number"))

        grn = GoodsReceipt.objects.create(**validated_data)
        for line in lines:
            GoodsReceiptLine.objects.create(goods_receipt=grn, **line)

        return grn

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines is not None:
            instance.lines.all().delete()
            for line in lines:
                GoodsReceiptLine.objects.create(goods_receipt=instance, **line)

        return instance


# ─── Bill ─────────────────────────────────────────────────────────────────────

class BillLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku  = serializers.CharField(source="product.sku",  read_only=True)

    class Meta:
        model = BillLine
        fields = [
            "id", "goods_receipt_line", "product", "product_name", "product_sku",
            "quantity", "unit_price", "hsn_code", "gst_rate",
            "taxable_amount", "cgst_amount", "sgst_amount", "igst_amount", "line_total",
        ]
        # Tax is computed server-side and snapshotted; a client cannot dictate it.
        read_only_fields = [
            "taxable_amount", "cgst_amount", "sgst_amount", "igst_amount", "line_total",
        ]


class BillSerializer(serializers.ModelSerializer):
    lines           = BillLineSerializer(many=True)
    supplier_name   = serializers.CharField(source="supplier.name", read_only=True)
    supplier_detail = SupplierSerializer(source="supplier", read_only=True)
    warehouse_name  = serializers.CharField(source="warehouse.name", read_only=True, default=None)
    paid_amount     = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    balance_due     = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    bill_number     = serializers.CharField(required=False, allow_blank=True)
    # The (supplier, supplier_bill_number) UniqueConstraint makes DRF generate a
    # UniqueTogetherValidator, which would otherwise make this mandatory. It
    # isn't: the supplier's own number is often unknown when the bill is drafted,
    # and the constraint is conditional on it being non-empty anyway.
    supplier_bill_number = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = Bill
        fields = [
            "id", "bill_number", "supplier_bill_number", "supplier_bill_date",
            "supplier", "supplier_name", "supplier_detail",
            "purchase_order", "warehouse", "warehouse_name", "updates_stock",
            "status", "bill_date", "due_date", "place_of_supply",
            "subtotal", "discount_amount", "tax_total", "total_amount",
            "paid_amount", "balance_due",
            "notes", "created_by", "created_at", "updated_at", "lines",
        ]
        read_only_fields = [
            "status", "subtotal", "tax_total", "total_amount",
            "created_by", "created_at", "updated_at",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if self.instance and self.instance.status != "DRAFT":
            raise serializers.ValidationError({
                "status": f"A {self.instance.status} bill cannot be edited. Cancel it instead."
            })

        updates_stock = attrs.get(
            "updates_stock", getattr(self.instance, "updates_stock", False)
        )
        warehouse = attrs.get("warehouse", getattr(self.instance, "warehouse", None))

        # Invariant 11 — mirrored as a DB CheckConstraint, but caught here so
        # the client gets a field error rather than an IntegrityError.
        if updates_stock and warehouse is None:
            raise serializers.ValidationError({
                "warehouse": "A bill that posts stock must name a warehouse."
            })

        # Invariant 10 — the double-count guard.
        lines = attrs.get("lines")
        if updates_stock and lines and any(line.get("goods_receipt_line") for line in lines):
            raise serializers.ValidationError({
                "updates_stock": (
                    "These lines come from a goods receipt, which already moved the stock. "
                    "Turn off 'updates stock' or remove the receipt link."
                )
            })

        return attrs

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("A bill must have at least one line.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines", [])
        validated_data["bill_number"] = assign_document_number("BILL", validated_data.get("bill_number"))

        bill = Bill.objects.create(**validated_data)
        self._write_lines(bill, lines)
        return bill

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines is not None:
            instance.lines.all().delete()
            self._write_lines(instance, lines)
        else:
            self._recompute_totals(instance)

        return instance

    # ── Tax & totals ──────────────────────────────────────────────────────────
    def _write_lines(self, bill, lines):
        """Snapshot HSN + rate onto each line and compute the tax split.

        Amounts are stored, never recomputed on read: a historical bill must
        show the tax it was actually raised with, even after rates change.
        """
        place_of_supply = bill.place_of_supply or (bill.supplier.state_code if bill.supplier_id else "")
        intra_state = is_intra_state(place_of_supply)

        for line in lines:
            product = line["product"]

            # Fall back to the product's HSN default when the client didn't
            # send one — but what lands on the row is a snapshot either way.
            hsn_code = line.get("hsn_code") or ""
            gst_rate = line.get("gst_rate")
            if (not hsn_code or gst_rate is None) and product.hsn_code_id:
                hsn_code = hsn_code or product.hsn_code.code
                gst_rate = gst_rate if gst_rate is not None else product.hsn_code.gst_rate

            amounts = compute_line_amounts(
                quantity=line["quantity"],
                unit_price=line["unit_price"],
                gst_rate=gst_rate or 0,
                intra_state=intra_state,
            )

            BillLine.objects.create(
                bill=bill,
                goods_receipt_line=line.get("goods_receipt_line"),
                product=product,
                quantity=line["quantity"],
                unit_price=line["unit_price"],
                hsn_code=hsn_code,
                gst_rate=gst_rate or 0,
                **amounts,
            )

        self._recompute_totals(bill)

    @staticmethod
    def _recompute_totals(bill):
        lines = list(bill.lines.all())
        bill.subtotal = sum((line.taxable_amount for line in lines), decimal.Decimal("0.00"))
        bill.tax_total = sum(
            (line.cgst_amount + line.sgst_amount + line.igst_amount for line in lines),
            decimal.Decimal("0.00"),
        )
        bill.total_amount = bill.subtotal + bill.tax_total - (bill.discount_amount or decimal.Decimal("0.00"))
        bill.save(update_fields=["subtotal", "tax_total", "total_amount", "updated_at"])


# ─── Payment out ──────────────────────────────────────────────────────────────

class PaymentOutAllocationSerializer(serializers.ModelSerializer):
    bill_number = serializers.CharField(source="bill.bill_number", read_only=True)
    bill_total  = serializers.DecimalField(
        source="bill.total_amount", max_digits=14, decimal_places=2, read_only=True,
    )

    class Meta:
        model = PaymentOutAllocation
        fields = ["id", "bill", "bill_number", "bill_total", "amount"]


class PaymentOutSerializer(serializers.ModelSerializer):
    allocations   = PaymentOutAllocationSerializer(many=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    allocated_amount   = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    unallocated_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    payment_number = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = PaymentOut
        fields = [
            "id", "payment_number", "supplier", "supplier_name", "amount",
            "method", "status", "paid_date", "reference", "notes",
            "created_by", "created_at",
            "allocations", "allocated_amount", "unallocated_amount",
        ]
        read_only_fields = ["created_by", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)

        allocations = attrs.get("allocations") or []
        amount = attrs.get("amount", getattr(self.instance, "amount", 0))
        supplier = attrs.get("supplier", getattr(self.instance, "supplier", None))

        allocated = sum((decimal.Decimal(str(a["amount"])) for a in allocations), decimal.Decimal("0.00"))
        if allocated > decimal.Decimal(str(amount)):
            raise serializers.ValidationError({
                "allocations": f"Allocated {allocated} exceeds the payment amount of {amount}."
            })

        for allocation in allocations:
            bill = allocation["bill"]
            if supplier and bill.supplier_id != supplier.pk:
                raise serializers.ValidationError({
                    "allocations": f"Bill {bill.bill_number} belongs to a different supplier."
                })
            if bill.status in {"DRAFT", "CANCELLED"}:
                raise serializers.ValidationError({
                    "allocations": f"Bill {bill.bill_number} is {bill.status} and cannot take a payment."
                })
            # Invariant 7.
            purchase_service.guard_allocation_within_total(
                bill,
                allocation["amount"],
                exclude_payment_id=self.instance.pk if self.instance else None,
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        allocations = validated_data.pop("allocations", [])
        validated_data["payment_number"] = assign_document_number("PAYOUT", validated_data.get("payment_number"))

        payment = PaymentOut.objects.create(**validated_data)
        for allocation in allocations:
            PaymentOutAllocation.objects.create(payment=payment, **allocation)

        for allocation in allocations:
            purchase_service.sync_bill_payment_status(allocation["bill"])

        return payment

    @transaction.atomic
    def update(self, instance, validated_data):
        allocations = validated_data.pop("allocations", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if allocations is not None:
            # Keep the bills the old allocations touched so their status is
            # resynced even when the payment moves away from them.
            touched = {a.bill for a in instance.allocations.select_related("bill").all()}
            instance.allocations.all().delete()

            for allocation in allocations:
                PaymentOutAllocation.objects.create(payment=instance, **allocation)
                touched.add(allocation["bill"])

            for bill in touched:
                bill.refresh_from_db()
                purchase_service.sync_bill_payment_status(bill)

        return instance




