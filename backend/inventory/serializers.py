from rest_framework import serializers

from .models import  Product, Customer,Invoice,InvoiceItem


class ProductSerializer(serializers.ModelSerializer):
    # last_modified_by = serializers.ReadOnlyField() # It not work since it is a foreign key(), (TypeError: Object of type User is not JSON serializable,)
    last_modified_by_username= serializers.ReadOnlyField() # Since this field is addded by perform_create, it will not be passed by the client, so it is read only fiel
    updated_at = serializers.ReadOnlyField()
    created_at = serializers.ReadOnlyField()
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
        # fields = ["id", "product", "quantity", "price", "total"]
        read_only_fields = ["total"]

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)
    last_modified_by_username= serializers.ReadOnlyField()
    class Meta:
        model = Invoice
        fields = "__all__"
    read_only_fields = ["total_amount"]

    def create(self, validated_data):
        items_data = validated_data.pop("items")

        # 🚨 enforce at least one item
        if not items_data:
            raise serializers.ValidationError({
                "items": "Invoice must have at least one item"
            })

        invoice = Invoice.objects.create(**validated_data)

        for item_data in items_data:
            InvoiceItem.objects.create(
                invoice=invoice,
                **item_data
            )

        # 🔥 update total
        invoice.update_total()

        return invoice



