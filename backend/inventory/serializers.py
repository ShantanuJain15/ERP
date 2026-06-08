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
    invoice_number = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = ["total_amount"]

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

    # ── UPDATE (PATCH / PUT) with full dirty-checking ────────────────────────
    def update(self, instance, validated_data):
        import decimal

        items_data = validated_data.pop("items", None)

        # ── 1. Dirty-check scalar fields ──────────────────────────────────────
        changed_fields = []
        for attr, new_value in validated_data.items():
            old_value = getattr(instance, attr)
            # normalise Decimal comparisons
            if isinstance(old_value, decimal.Decimal):
                try:
                    new_value = decimal.Decimal(str(new_value))
                except Exception:
                    pass
            if old_value != new_value:
                setattr(instance, attr, new_value)
                changed_fields.append(attr)

        explicit_status = "status" in validated_data
        if "paid_amount" in changed_fields and not explicit_status:
            old_status = instance.status
            self._sync_status(instance)
            if instance.status != old_status:
                changed_fields.append("status")

        if changed_fields:
            instance.save(update_fields=changed_fields)

        # ── 2. Smart per-item update ───────────────────────────────────────────
        if items_data is not None:
            # keyed by product_id for O(1) lookup
            existing_map = {
                item.product_id: item
                for item in instance.items.select_related("product").all()
            }
            # validated_data already resolved FK → Product instance
            incoming_map = {
                d["product"].pk: d
                for d in items_data
            }

            # Quick exit: are the sets and values identical?
            def _items_identical():
                if existing_map.keys() != incoming_map.keys():
                    return False
                for pid, d in incoming_map.items():
                    ex = existing_map[pid]
                    if (ex.quantity != int(d["quantity"]) or
                            ex.price != decimal.Decimal(str(d["price"]))):
                        return False
                return True

            if not _items_identical():

                # ── 2a. update or add ─────────────────────────────────────────
                for pid, d in incoming_map.items():
                    new_qty   = int(d["quantity"])
                    new_price = decimal.Decimal(str(d["price"]))

                    if pid in existing_map:
                        item = existing_map[pid]
                        item_changed_fields = []

                        if item.quantity != new_qty:
                            delta = new_qty - item.quantity   # +ve = need more
                            # adjust product stock by ONLY the delta
                            item.product.quantity -= delta
                            item.product.save(update_fields=["quantity"])
                            item.quantity = new_qty
                            item_changed_fields.append("quantity")

                        if item.price != new_price:
                            item.price = new_price
                            item_changed_fields.append("price")

                        if item_changed_fields:
                            item.total = item.quantity * item.price
                            item_changed_fields.append("total")
                            # skip model-level save() side-effects by using
                            # update_fields (pk exists → stock block skipped)
                            item.save(update_fields=item_changed_fields)

                    else:
                        # brand-new item – InvoiceItem.save() deducts stock
                        InvoiceItem.objects.create(
                            invoice=instance,
                            product=d["product"],
                            quantity=new_qty,
                            price=new_price,
                        )

                # ── 2b. remove dropped items, restore their stock ─────────────
                for pid, item in existing_map.items():
                    if pid not in incoming_map:
                        item.product.quantity += item.quantity   # restore
                        item.product.save(update_fields=["quantity"])
                        item.delete()

                # ── 2c. recalculate invoice total ─────────────────────────────
                instance.update_total()

                if not explicit_status:
                    old_status = instance.status
                    self._sync_status(instance)
                    save_cols = ["total_amount"]
                    if instance.status != old_status:
                        save_cols.append("status")
                    instance.save(update_fields=save_cols)
                else:
                    instance.save(update_fields=["total_amount"])

        return instance



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




