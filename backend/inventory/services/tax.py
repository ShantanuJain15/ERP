"""GST computation.

One function, deliberately. The sales-side Invoice has no per-line tax yet; when
it grows some it must call *this*, not a second implementation that rounds
differently and disagrees on the CGST/SGST split.

Prices in this system are GST-exclusive: `unit_price` is the taxable value and
tax is added on top.
"""

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings


TWO_PLACES = Decimal("0.01")


def _money(value):
    """Round to paise, half-up. Banker's rounding is wrong for money here."""
    return Decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def is_intra_state(party_state_code, company_state_code=None):
    """Same state => CGST + SGST. Different state => IGST.

    Falls back to intra-state when either side is unknown, because CGST+SGST is
    the common case and a wrong IGST is the more visible error on a document.
    """
    company_state_code = company_state_code or getattr(settings, "COMPANY_STATE_CODE", "")

    if not party_state_code or not company_state_code:
        return True

    return str(party_state_code).strip() == str(company_state_code).strip()


def compute_line_tax(taxable_amount, gst_rate, intra_state):
    """Split `taxable_amount` x `gst_rate` into (cgst, sgst, igst).

    Intra-state gives CGST + SGST, each exactly half, and they are always equal.
    Inter-state gives IGST only. Never both — that is invariant 14 in
    docs/domain/03-order-to-cash.md.
    """
    taxable_amount = Decimal(str(taxable_amount or 0))
    gst_rate = Decimal(str(gst_rate or 0))

    total_tax = _money(taxable_amount * gst_rate / Decimal("100"))

    if not intra_state:
        return Decimal("0.00"), Decimal("0.00"), total_tax

    # Halve the *rounded* total so cgst + sgst == total_tax exactly, rather
    # than rounding each half and drifting a paisa apart.
    half = _money(total_tax / Decimal("2"))
    return half, total_tax - half, Decimal("0.00")


def compute_line_amounts(quantity, unit_price, gst_rate, intra_state):
    """Full money breakdown for one document line.

    Returns a dict ready to splat onto a BillLine.
    """
    taxable_amount = _money(Decimal(str(quantity)) * Decimal(str(unit_price)))
    cgst, sgst, igst = compute_line_tax(taxable_amount, gst_rate, intra_state)

    return {
        "taxable_amount": taxable_amount,
        "cgst_amount": cgst,
        "sgst_amount": sgst,
        "igst_amount": igst,
        "line_total": taxable_amount + cgst + sgst + igst,
    }
