"""
Server-side invoice PDF.

Mirrors the on-screen document rendered by
``frontend/src/components/invoice-templates/InvoicePaper.jsx`` so a downloaded
or emailed invoice matches what the user sees in the browser.

Two templates match the Standard / Classic switch on the invoice detail page.
As in the CSS, they share structure and data and differ only in typography —
Standard is sans-serif, Classic is serif with a heavier title.

Note on the rupee sign: ReportLab's built-in Type1 fonts use WinAnsiEncoding,
which has no U+20B9, so a literal "₹" renders as a black box. Amounts are
prefixed "Rs." instead. Registering a TTF (e.g. DejaVuSans) would allow the
real glyph.
"""

from datetime import timedelta

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

# ── Palette — mirrors the CSS custom properties on .invoice-paper ────────────

INK    = colors.HexColor("#1a1a1a")
MUTED  = colors.HexColor("#6b7280")
LINE   = colors.HexColor("#e5e7eb")
ACCENT = colors.HexColor("#2563eb")   # --p-accent, standard
SLATE  = colors.HexColor("#111827")   # --p-accent, classic

TEMPLATES = {
    "standard": {
        "body":   "Helvetica",
        "bold":   "Helvetica-Bold",
        "italic": "Helvetica-Oblique",
        "title":  "Helvetica",
        "accent": ACCENT,
    },
    "classic": {
        "body":   "Times-Roman",
        "bold":   "Times-Bold",
        "italic": "Times-Italic",
        "title":  "Times-Bold",       # .invoice-paper--classic .invoice-doc-title
        "accent": SLATE,
    },
}
DEFAULT_TEMPLATE = "standard"


def resolve_template(name):
    """Map an arbitrary request value onto a known template, never raising."""
    key = (name or "").strip().lower()
    return key if key in TEMPLATES else DEFAULT_TEMPLATE


# ── Formatting helpers ───────────────────────────────────────────────────────

def _group_indian(digits: str) -> str:
    """12345678 -> 1,23,45,678 (last three, then pairs)."""
    if len(digits) <= 3:
        return digits
    head, tail = digits[:-3], digits[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return f"{','.join(parts)},{tail}"


def money(value) -> str:
    """Match the browser's en-IN currency formatting, minus the ₹ glyph."""
    amount = round(float(value or 0), 2)
    sign = "-" if amount < 0 else ""
    whole, frac = f"{abs(amount):.2f}".split(".")
    return f"{sign}Rs. {_group_indian(whole)}.{frac}"


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
         "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
         "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
         "Eighty", "Ninety"]


def _two_digits(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return f"{_TENS[n // 10]}{' ' + _ONES[n % 10] if n % 10 else ''}"


def _three_digits(n: int) -> str:
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds:
        parts.append(f"{_ONES[hundreds]} Hundred")
    if rest:
        parts.append(_two_digits(rest))
    return " ".join(parts)


def amount_in_words(value) -> str:
    """125300 -> 'One Lakh Twenty Five Thousand Three Hundred Rupees Only'."""
    total = int(round(float(value or 0)))
    if not total:
        return "Zero Rupees Only"

    crore, rest = divmod(total, 10_000_000)
    lakh,  rest = divmod(rest, 100_000)
    thousand, rest = divmod(rest, 1_000)

    parts = []
    if crore:
        parts.append(f"{_three_digits(crore)} Crore")
    if lakh:
        parts.append(f"{_two_digits(lakh)} Lakh")
    if thousand:
        parts.append(f"{_two_digits(thousand)} Thousand")
    if rest:
        parts.append(_three_digits(rest))
    return f"{' '.join(parts)} Rupees Only"


def _fmt_date(value) -> str:
    return value.strftime("%d %b %Y") if value else "—"


def _company() -> dict:
    """Seller identity. Mirrors frontend/src/config/company.js."""
    return {
        "name":    getattr(settings, "COMPANY_NAME", ""),
        "address": getattr(settings, "COMPANY_ADDRESS", ""),
        "city":    getattr(settings, "COMPANY_CITY", ""),
        "pincode": getattr(settings, "COMPANY_PINCODE", ""),
        "email":   getattr(settings, "COMPANY_EMAIL", ""),
        "phone":   getattr(settings, "COMPANY_PHONE", ""),
        "gstin":   getattr(settings, "COMPANY_GSTIN", ""),
    }


# ── Document ─────────────────────────────────────────────────────────────────

def generate_invoice_pdf(buffer, invoice, template=DEFAULT_TEMPLATE):
    """
    Render ``invoice`` into ``buffer`` as a PDF.

    ``template`` is "standard" or "classic"; anything else falls back to
    standard rather than raising, so a bad query param cannot break a download.
    """
    tpl = TEMPLATES[resolve_template(template)]
    body, bold, italic = tpl["body"], tpl["bold"], tpl["italic"]

    company = _company()
    customer = invoice.customer
    items = list(invoice.items.select_related("product").all())
    term_days = getattr(settings, "PAYMENT_TERM_DAYS", 30)
    due_date = invoice.date + timedelta(days=term_days) if invoice.date else None

    subtotal = sum(float(it.total or 0) for it in items)
    paid = float(invoice.paid_amount or 0)
    total = float(invoice.total_amount or 0)
    balance = total - paid

    # ── Paragraph styles ────────────────────────────────────────────────────
    s_seller_name = ParagraphStyle("seller_name", fontName=bold, fontSize=13,
                                   textColor=INK, leading=16, spaceAfter=3)
    s_seller = ParagraphStyle("seller", fontName=body, fontSize=8.5,
                              textColor=MUTED, leading=11.5)
    s_title = ParagraphStyle("title", fontName=tpl["title"], fontSize=20,
                             textColor=tpl["accent"], alignment=2, leading=24)
    s_draft = ParagraphStyle("draft", fontName=bold, fontSize=9,
                             textColor=colors.white, alignment=1, leading=12)
    s_key = ParagraphStyle("key", fontName=body, fontSize=8.5,
                           textColor=MUTED, leading=11)
    s_val = ParagraphStyle("val", fontName=bold, fontSize=8.5,
                           textColor=INK, leading=11)
    s_label = ParagraphStyle("label", fontName=bold, fontSize=7.5,
                             textColor=MUTED, leading=10)
    s_who = ParagraphStyle("who", fontName=bold, fontSize=10,
                           textColor=INK, leading=13, spaceBefore=2)
    s_addr = ParagraphStyle("addr", fontName=body, fontSize=8.5,
                            textColor=MUTED, leading=11.5, spaceBefore=2)
    s_th = ParagraphStyle("th", fontName=bold, fontSize=8.5,
                          textColor=colors.white, leading=11)
    s_th_r = ParagraphStyle("th_r", parent=s_th, alignment=2)
    s_item = ParagraphStyle("item", fontName=bold, fontSize=9,
                            textColor=INK, leading=12)
    s_sub = ParagraphStyle("sub", fontName=body, fontSize=7.5,
                           textColor=MUTED, leading=10)
    s_cell = ParagraphStyle("cell", fontName=body, fontSize=9,
                            textColor=INK, leading=12)
    s_cell_r = ParagraphStyle("cell_r", parent=s_cell, alignment=2)
    s_words = ParagraphStyle("words", fontName=body, fontSize=8.5,
                             textColor=INK, leading=12)
    s_note_h = ParagraphStyle("note_h", fontName=bold, fontSize=8.5,
                              textColor=INK, leading=12, spaceAfter=3)
    s_note = ParagraphStyle("note", fontName=body, fontSize=8.5,
                            textColor=MUTED, leading=12)
    s_sign = ParagraphStyle("sign", fontName=body, fontSize=8.5,
                            textColor=MUTED, alignment=1, leading=11)

    story = []

    # ── Header: seller block | TAX INVOICE ──────────────────────────────────
    seller_lines = [Paragraph(company["name"], s_seller_name)]
    for line in (company["address"], company["city"], company["pincode"],
                 company["email"], company["phone"]):
        if line:
            seller_lines.append(Paragraph(line, s_seller))
    if company["gstin"]:
        seller_lines.append(Paragraph(f"GSTIN: {company['gstin']}", s_seller))

    head_right = [Paragraph("TAX INVOICE", s_title)]
    if invoice.status == "DRAFT":
        head_right.append(Spacer(1, 6))
        draft = Table([[Paragraph("DRAFT", s_draft)]], colWidths=[26 * mm])
        draft.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#94a3b8")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        head_right.append(Table([[draft]], colWidths=[92 * mm],
                                style=[("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                                       ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                       ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    header = Table([[seller_lines, head_right]], colWidths=[94 * mm, 92 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story += [header, Spacer(1, 20)]

    # ── Meta: number / date / terms / due date ──────────────────────────────
    meta = Table(
        [
            [Paragraph("#", s_key), Paragraph(invoice.invoice_number, s_val),
             Paragraph("Invoice Date", s_key), Paragraph(_fmt_date(invoice.date), s_val)],
            [Paragraph("Terms", s_key), Paragraph(f"Net {term_days}", s_val),
             Paragraph(f"Due Date (Net {term_days})", s_key),
             Paragraph(_fmt_date(due_date), s_val)],
        ],
        colWidths=[33 * mm, 60 * mm, 33 * mm, 60 * mm],
    )
    meta.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [meta, Spacer(1, 16)]

    # ── Bill To / Ship To ───────────────────────────────────────────────────
    bill_to = "<br/>".join(
        str(x) for x in (customer.address, customer.phone, customer.email) if x
    ) or "No address on file"

    parties = Table(
        [[
            [Paragraph("BILL TO", s_label),
             Paragraph(customer.name or "—", s_who),
             Paragraph(bill_to, s_addr)],
            [Paragraph("SHIP TO", s_label),
             Paragraph(customer.address or "Same as billing address", s_addr)],
        ]],
        colWidths=[93 * mm, 93 * mm],
    )
    parties.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LINEAFTER", (0, 0), (0, 0), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [parties, Spacer(1, 16)]

    # ── Line items ──────────────────────────────────────────────────────────
    rows = [[
        Paragraph("#", s_th), Paragraph("Item &amp; Description", s_th),
        Paragraph("Qty", s_th_r), Paragraph("Rate", s_th_r),
        Paragraph("Amount", s_th_r),
    ]]

    if not items:
        rows.append([Paragraph("No line items",
                               ParagraphStyle("empty", parent=s_cell,
                                              alignment=1, textColor=MUTED)),
                     "", "", "", ""])
    else:
        for i, it in enumerate(items, start=1):
            product = it.product
            cell = [Paragraph(getattr(product, "name", f"Product #{it.product_id}"), s_item)]
            if getattr(product, "sku", ""):
                cell.append(Paragraph(f"SKU: {product.sku}", s_sub))
            if it.description:
                cell.append(Paragraph(it.description, s_sub))
            rows.append([
                Paragraph(str(i), s_cell),
                cell,
                Paragraph(str(it.quantity), s_cell_r),
                Paragraph(money(it.price), s_cell_r),
                Paragraph(money(it.total), s_cell_r),
            ])

    items_table = Table(
        rows, repeatRows=1,
        colWidths=[10 * mm, 86 * mm, 18 * mm, 34 * mm, 38 * mm],
    )
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), tpl["accent"]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    if not items:
        style.append(("SPAN", (0, 1), (-1, 1)))
    items_table.setStyle(TableStyle(style))
    story += [items_table, Spacer(1, 14)]

    # ── Totals (right-aligned block) ────────────────────────────────────────
    totals_rows = [
        [Paragraph("Sub Total", s_key), Paragraph(money(subtotal), s_cell_r)],
        [Paragraph("Total", ParagraphStyle("tk", parent=s_val, fontSize=9.5)),
         Paragraph(money(total), ParagraphStyle("tv", parent=s_cell_r,
                                                fontName=bold, fontSize=9.5))],
        [Paragraph("Amount Paid", s_key),
         Paragraph(f"- {money(paid)}", s_cell_r)],
        [Paragraph("Balance Due", ParagraphStyle("bk", parent=s_val, fontSize=10)),
         Paragraph(money(balance), ParagraphStyle("bv", parent=s_cell_r,
                                                  fontName=bold, fontSize=10,
                                                  textColor=tpl["accent"]))],
    ]
    totals = Table(totals_rows, colWidths=[38 * mm, 40 * mm])
    totals.setStyle(TableStyle([
        ("LINEABOVE", (0, 1), (-1, 1), 0.5, LINE),
        ("LINEABOVE", (0, 3), (-1, 3), 0.75, INK),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    totals_wrap = Table([["", totals]], colWidths=[108 * mm, 78 * mm])
    totals_wrap.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story += [totals_wrap, Spacer(1, 14)]

    # ── Amount in words ─────────────────────────────────────────────────────
    story.append(Paragraph(
        f"<b>Total in words:</b> <i>{amount_in_words(total)}</i>", s_words))
    story.append(Spacer(1, 22))

    # ── Notes + signature ───────────────────────────────────────────────────
    signature = Table([[""], [Paragraph("Authorized Signature", s_sign)]],
                      colWidths=[55 * mm], rowHeights=[16 * mm, None])
    signature.setStyle(TableStyle([
        ("LINEABOVE", (0, 1), (-1, 1), 0.5, INK),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 4),
    ]))

    footer = Table(
        [[
            [Paragraph("Notes", s_note_h),
             Paragraph("Thanks for your business.", s_note),
             Spacer(1, 6),
             Paragraph(f"Payment due within {term_days} days of the invoice date.",
                       s_note)],
            [signature],
        ]],
        colWidths=[121 * mm, 65 * mm],
    )
    footer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (0, 0), "TOP"),
        ("VALIGN", (1, 0), (1, 0), "BOTTOM"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(footer)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm, rightMargin=12 * mm,
        topMargin=12 * mm, bottomMargin=12 * mm,
        title=f"Invoice {invoice.invoice_number}",
        author=company["name"],
    )
    doc.build(story)
