import re

from rest_framework import serializers

from .models import  Product, ACProduct, Customer,Invoice,InvoiceItem


class ACProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = ACProduct
        fields = ["tonnage", "star_rating", "energy_label", "refrigerant_type"]


class ProductSerializer(serializers.ModelSerializer):
    # last_modified_by = serializers.ReadOnlyField() # It not work since it is a foreign key(), (TypeError: Object of type User is not JSON serializable,)
    last_modified_by_username= serializers.ReadOnlyField() # Since this field is addded by perform_create, it will not be passed by the client, so it is read only fiel
    updated_at = serializers.ReadOnlyField()
    created_at = serializers.ReadOnlyField()
    ac_details = ACProductSerializer(required=False, allow_null=True)

    class Meta:
        model = Product
        fields = "__all__"

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
        product = Product.objects.create(**validated_data)

        if product.type == "AC" and ac_data:
            ACProduct.objects.create(product=product, **ac_data)

        return product

    def update(self, instance, validated_data):
        ac_data = validated_data.pop("ac_details", None)

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


# class ACSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = AC
#         fields = "__all__"


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = "__all__"



class InvoiceItemSerializer(serializers.ModelSerializer):
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




