from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet


def generate_invoice_pdf(buffer, invoice):
    styles = getSampleStyleSheet()
    elements = []

    # Header
    elements.append(Paragraph(f"Invoice #{invoice.invoice_number}", styles["Title"]))
    elements.append(Spacer(1, 10))

    elements.append(Paragraph(f"Customer: {invoice.customer}", styles["Normal"]))
    elements.append(Paragraph(f"Date: {invoice.date}", styles["Normal"]))
    elements.append(Paragraph(f"Status: {invoice.status}", styles["Normal"]))
    elements.append(Spacer(1, 20))

    # Table
    table_data = [["ID", "Product", "Qty", "Price", "Total"]]

    for item in invoice.items.all():
        table_data.append([
            item.id,
            str(item.product),
            item.quantity,
            str(item.price),
            str(item.total)
        ])

    table = Table(table_data, repeatRows=1)

    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 20))

    elements.append(Paragraph(f"Total: {invoice.total_amount}", styles["Normal"]))

    doc = SimpleDocTemplate(buffer, pagesize=letter)
    doc.build(elements)