from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from inventory.models import Product, StockMovement, Warehouse, WarehouseStock


POSITIVE_MOVEMENT_TYPES = {"IN", "RETURN", "ADJ_UP"}
NEGATIVE_MOVEMENT_TYPES = {"OUT", "DAMAGE", "ADJ_DOWN"}


def movement_quantity_change(movement_type, quantity):
    if movement_type in POSITIVE_MOVEMENT_TYPES:
        return quantity
    if movement_type in NEGATIVE_MOVEMENT_TYPES:
        return -quantity
    raise ValidationError({"movement_type": "Unsupported movement type."})


def next_stock_movement_number():
    last_number = (
        StockMovement.objects.filter(movement_number__startswith="SM-")
        .order_by("-id")
        .values_list("movement_number", flat=True)
        .first()
    )
    if not last_number:
        return "SM-000001"

    try:
        next_sequence = int(last_number.split("-")[-1]) + 1
    except (TypeError, ValueError):
        next_sequence = (StockMovement.objects.count() or 0) + 1

    return f"SM-{next_sequence:06d}"


def sync_product_quantity(product):
    product_id = product.pk if hasattr(product, "pk") else product
    total_quantity = (
        WarehouseStock.objects.filter(product_id=product_id)
        .aggregate(total=Sum("quantity"))
        .get("total")
        or 0
    )

    Product.objects.filter(pk=product_id).update(quantity=total_quantity)
    if hasattr(product, "quantity"):
        product.quantity = total_quantity
    return product


def record_stock_movement(
    *,
    warehouse,
    product,
    movement_type,
    quantity,
    reference_type="MANUAL",
    reference_number="",
    notes="",
    performed_by="",
):
    if not warehouse:
        raise ValidationError({"warehouse": "Warehouse is required."})
    if not product:
        raise ValidationError({"product": "Product is required."})
    if not movement_type:
        raise ValidationError({"movement_type": "Movement type is required."})
    if quantity is None:
        raise ValidationError({"quantity": "Quantity is required."})

    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        raise ValidationError({"quantity": "Quantity must be a whole number."})

    if quantity <= 0:
        raise ValidationError({"quantity": "Quantity must be greater than zero."})

    quantity_change = movement_quantity_change(movement_type, quantity)

    with transaction.atomic():
        product = Product.objects.select_for_update().get(pk=product.pk)
        warehouse = Warehouse.objects.select_for_update().get(pk=warehouse.pk)

        stock, _ = WarehouseStock.objects.select_for_update().get_or_create(
            warehouse=warehouse,
            product=product,
            defaults={"quantity": 0, "reserved_quantity": 0},
        )

        new_quantity = stock.quantity + quantity_change
        if new_quantity < 0:
            raise ValidationError({
                "quantity": (
                    f"Insufficient stock in {warehouse.name}. "
                    f"Available quantity is {stock.quantity}."
                )
            })

        movement = StockMovement.objects.create(
            movement_number=next_stock_movement_number(),
            warehouse=warehouse,
            product=product,
            movement_type=movement_type,
            quantity=quantity,
            quantity_change=quantity_change,
            reference_type=reference_type or "MANUAL",
            reference_number=reference_number or "",
            notes=notes or "",
            performed_by=performed_by or "",
        )

        stock.quantity = new_quantity
        stock.save(update_fields=["quantity", "updated_at"])
        sync_product_quantity(product)

    return movement
