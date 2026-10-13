"""Verify the stock caches still agree with the ledger.

`StockMovement` is the append-only truth; `WarehouseStock.quantity` and
`Product.quantity` are caches of it. Invariants 3 and 4 in
docs/domain/04-inventory.md are checkable rather than enforceable, so they get a
command instead of a constraint.

Divergence means something wrote stock without going through
services/stock.record_stock_movement(). At the time of writing there is one
known source: InvoiceItem.save() mutates Product.quantity directly (see
inventory/models.py and 04-inventory.md). Rows flagged with no movements at all
are almost certainly that.

    python manage.py check_stock_integrity

Exits non-zero when anything diverges, so it can be wired into CI.
"""

from django.core.management.base import BaseCommand
from django.db.models import Sum

from inventory.models import Product, StockMovement, WarehouseStock


class Command(BaseCommand):
    help = "Check that stock caches match the append-only movement ledger."

    def add_arguments(self, parser):
        parser.add_argument(
            "--quiet", action="store_true",
            help="Only report problems, not the rows that are fine.",
        )

    def handle(self, *args, **options):
        quiet = options["quiet"]
        problems = []

        self.stdout.write(self.style.MIGRATE_HEADING("WarehouseStock vs ledger"))
        for stock in WarehouseStock.objects.select_related("product", "warehouse"):
            ledger = (
                StockMovement.objects
                .filter(warehouse=stock.warehouse, product=stock.product)
                .aggregate(total=Sum("quantity_change"))
                .get("total")
                or 0
            )
            line = f"  {stock.product.sku or '(no sku)':24s} @ {stock.warehouse.code:10s} cache={stock.quantity:6d} ledger={ledger:6d}"

            if ledger == stock.quantity:
                if not quiet:
                    self.stdout.write(self.style.SUCCESS(line))
            else:
                problems.append(
                    f"{stock.product.sku} @ {stock.warehouse.code}: "
                    f"cache {stock.quantity} vs ledger {ledger}"
                )
                self.stdout.write(self.style.ERROR(line))

        self.stdout.write(self.style.MIGRATE_HEADING("Product.quantity vs sum(WarehouseStock)"))
        for product in Product.objects.all():
            total = (
                WarehouseStock.objects
                .filter(product=product)
                .aggregate(total=Sum("quantity"))
                .get("total")
                or 0
            )
            line = f"  {product.sku or '(no sku)':24s} product={product.quantity:6d} warehouses={total:6d}"

            if total == product.quantity:
                if not quiet:
                    self.stdout.write(self.style.SUCCESS(line))
            else:
                movements = StockMovement.objects.filter(product=product).count()
                # ASCII only: this prints to a console whose codepage mangles em-dashes.
                hint = " - no movements at all; likely written outside the stock service" if movements == 0 else ""
                problems.append(f"{product.sku}: product {product.quantity} vs warehouses {total}{hint}")
                self.stdout.write(self.style.ERROR(line + hint))

        self.stdout.write("")
        if problems:
            self.stdout.write(self.style.ERROR(f"{len(problems)} divergence(s) found:"))
            for problem in problems:
                self.stdout.write(self.style.ERROR(f"  - {problem}"))
            raise SystemExit(1)

        self.stdout.write(self.style.SUCCESS("Stock is consistent."))
