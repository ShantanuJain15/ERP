import io
from django.core.mail import EmailMessage
from django.conf import settings

from .invoice_pdf import generate_invoice_pdf


def send_invoice_email(invoice, recipient_email: str = None):
    """
    Generate a PDF for the given Invoice instance and send it as an email
    attachment to the customer.

    Args:
        invoice:          An Invoice model instance (with related customer and items).
        recipient_email:  Override the destination address. If not provided the
                          customer's stored email address is used.

    Returns:
        The number of successfully sent messages (0 or 1).

    Raises:
        ValueError: if no email address can be determined for the customer.
    """
    # ── Resolve recipient ────────────────────────────────────────────────────
    to_email = recipient_email or getattr(invoice.customer, "email", None)
    if not to_email:
        raise ValueError(
            f"No email address found for customer '{invoice.customer}'. "
            "Please provide a recipient_email or add an email to the customer."
        )

    # ── Build PDF in memory ──────────────────────────────────────────────────
    buffer = io.BytesIO()
    generate_invoice_pdf(buffer, invoice)
    buffer.seek(0)
    pdf_bytes = buffer.read()
    buffer.close()

    # ── Compose email ────────────────────────────────────────────────────────
    subject = f"Invoice #{invoice.invoice_number} from {settings.COMPANY_NAME}"

    body = (
        f"Dear {invoice.customer.name},\n\n"
        f"Please find attached your invoice #{invoice.invoice_number} "
        f"dated {invoice.date.strftime('%d %B %Y')}.\n\n"
        f"Invoice Summary\n"
        f"---------------\n"
        f"Total Amount : ₹{invoice.total_amount}\n"
        f"Paid Amount  : ₹{invoice.paid_amount}\n"
        f"Status       : {invoice.get_status_display()}\n\n"
        f"If you have any questions, please don't hesitate to contact us.\n\n"
        f"Thank you for your business!\n\n"
        f"Best regards,\n"
        f"{settings.COMPANY_NAME}\n"
        f"{getattr(settings, 'COMPANY_PHONE', '')}"
    )

    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )

    filename = f"invoice_{invoice.invoice_number}.pdf"
    email.attach(filename, pdf_bytes, "application/pdf")

    return email.send(fail_silently=False)
