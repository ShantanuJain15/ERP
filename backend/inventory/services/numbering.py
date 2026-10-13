"""Document numbering.

One row per document type in `NumberSeries`, incremented under a row lock.

This replaces the "scan for the max, then +1" approach used elsewhere in this
app (`InvoiceSerializer._next_invoice_number`, `next_stock_movement_number`),
which races — two concurrent creates read the same maximum and take the same
number.

NOTE: `select_for_update()` is a silent no-op on SQLite, the DB this project
currently runs on, so the lock below is presently decorative. It becomes real
on MySQL/Postgres without any code change.
"""

import re

from django.db import transaction

from inventory.models import NumberSeries


# `model` and `field` let a series seed itself past documents that already
# exist — needed because these tables predate the series table, and because a
# series row can be deleted while its documents remain.
SERIES = {
    "PO":     {"prefix": "PO-",   "padding": 5, "model": "PurchaseOrder", "field": "po_number"},
    "GRN":    {"prefix": "GRN-",  "padding": 5, "model": "GoodsReceipt",  "field": "grn_number"},
    "BILL":   {"prefix": "BILL-", "padding": 5, "model": "Bill",          "field": "bill_number"},
    "PAYOUT": {"prefix": "PAY-",  "padding": 5, "model": "PaymentOut",    "field": "payment_number"},
}

# Kept as the old public name; some callers imported it.
DEFAULT_SERIES = SERIES


def _config(document_type):
    if document_type not in SERIES:
        raise ValueError(f"Unknown document type: {document_type}")
    return SERIES[document_type]


def _format(prefix, number, padding):
    return f"{prefix}{number:0{padding}d}"


def _sequence_of(value, prefix):
    """Return the numeric tail of `value` if it belongs to `prefix`, else None."""
    if not value:
        return None
    match = re.fullmatch(rf"{re.escape(prefix)}(\d+)", str(value).strip())
    return int(match.group(1)) if match else None


def _highest_existing(document_type):
    """Largest sequence already used by a saved document of this type.

    A series row can be absent while its documents exist — the table was added
    after these models, and deleting the row (a reset) does not delete the
    documents. Seeding from reality stops a fresh series handing out a number
    that is already taken.
    """
    from django.apps import apps

    config = _config(document_type)
    model = apps.get_model("inventory", config["model"])
    prefix = config["prefix"]

    highest = 0
    values = model.objects.values_list(config["field"], flat=True)
    for value in values.iterator():
        sequence = _sequence_of(value, prefix)
        if sequence is not None and sequence > highest:
            highest = sequence

    return highest


def _get_or_create_series(document_type):
    config = _config(document_type)
    series = NumberSeries.objects.filter(document_type=document_type).first()
    if series is not None:
        return series

    return NumberSeries.objects.create(
        document_type=document_type,
        prefix=config["prefix"],
        padding=config["padding"],
        next_number=_highest_existing(document_type) + 1,
    )


@transaction.atomic
def next_document_number(document_type):
    """Consume and return the next number for `document_type`.

    Must be called inside the same transaction as the document create, so a
    rolled-back create doesn't burn a number.
    """
    series = _get_or_create_series(document_type)

    # Re-fetch under a lock: the get_or_create above may have raced.
    series = NumberSeries.objects.select_for_update().get(pk=series.pk)

    number = _format(series.prefix, series.next_number, series.padding)
    series.next_number += 1
    series.save(update_fields=["next_number", "updated_at"])

    return number


@transaction.atomic
def assign_document_number(document_type, supplied=None):
    """Decide the number a document being saved should carry.

    Three cases, and the middle one is the reason this function exists:

    1. Nothing supplied -> consume the series.
    2. The *peeked* value supplied -> consume the series. Our forms pre-fill the
       field with `peek_document_number()` for display, then post it straight
       back. Treating that as a hand-typed number would mean the series was
       never consumed, so every new document would offer the same number and
       the second save would hit the unique constraint.
    3. A genuinely different number supplied -> honour it, and push the series
       past it so it never hands out that number later.
    """
    series = _get_or_create_series(document_type)
    series = NumberSeries.objects.select_for_update().get(pk=series.pk)

    peeked = _format(series.prefix, series.next_number, series.padding)
    supplied = (supplied or "").strip()

    if not supplied or supplied == peeked:
        series.next_number += 1
        series.save(update_fields=["next_number", "updated_at"])
        return peeked

    # A manual override. Keep the series ahead of it so a later auto-assignment
    # cannot collide with what was just saved.
    sequence = _sequence_of(supplied, series.prefix)
    if sequence is not None and sequence >= series.next_number:
        series.next_number = sequence + 1
        series.save(update_fields=["next_number", "updated_at"])

    return supplied


def peek_document_number(document_type):
    """Return what `next_document_number` would produce, without consuming it.

    For pre-filling a form. The number is not reserved — the value actually
    assigned at create may differ if someone else saves first.
    """
    config = _config(document_type)
    series = NumberSeries.objects.filter(document_type=document_type).first()
    if series is None:
        return _format(config["prefix"], _highest_existing(document_type) + 1, config["padding"])

    return _format(series.prefix, series.next_number, series.padding)
