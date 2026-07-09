"""
PDF generation via @react-pdf/renderer (Node.js subprocess).

Generates the *exact same* visual PDF as the frontend download button,
ensuring pixel-perfect consistency for email attachments and backend
download endpoints.

Architecture:
    Django → JSON serialization → Node.js subprocess → @react-pdf/renderer → PDF bytes

The Node.js service lives at ``backend/pdf-service/`` and exposes a
``generate-pdf.ts`` script that reads JSON from stdin and writes PDF
bytes to stdout.

Usage::

    from apps.invoices.pdf_generator import generate_invoice_pdf

    pdf_bytes = generate_invoice_pdf(invoice)
    # pdf_bytes is raw PDF data ready for email attachment or HTTP response
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)

# Path to the Node.js PDF service directory
_PDF_SERVICE_DIR = Path(__file__).resolve().parent.parent.parent / 'backend' / 'pdf-service'


def _get_node_executable() -> str:
    """Return the path to the Node.js executable."""
    # Check common locations
    for name in ('node', 'nodejs'):
        node = subprocess.run(
            [name, '--version'],
            capture_output=True, text=True, timeout=5,
        )
        if node.returncode == 0:
            return name
    # Fallback — let the OS find it
    return 'node'


def _serialize_invoice(invoice) -> dict:
    """
    Serialize a Django Invoice model instance to the same JSON structure
    that the frontend TypeScript ``Invoice`` interface expects.
    """
    company = invoice.company
    customer = invoice.customer

    # Build company data
    company_data = {
        'name': company.name or '',
        'legal_name': getattr(company, 'legal_name', '') or '',
        'trn': company.trn or '',
        'street_address': getattr(company, 'street_address', '') or '',
        'city': getattr(company, 'city', '') or '',
        'emirate': getattr(company, 'emirate', '') or '',
        'po_box': getattr(company, 'po_box', '') or '',
        'country': getattr(company, 'country', 'United Arab Emirates') or 'United Arab Emirates',
        'phone': getattr(company, 'phone', '') or '',
        'email': getattr(company, 'email', '') or '',
        'website': getattr(company, 'website', '') or '',
        'logo_url': _company_logo_data_uri(company),
    }

    # Build customer data
    customer_data = {
        'customer_name': customer.name if customer else '',
        'customer_legal_name': getattr(customer, 'legal_name', '') if customer else '',
        'customer_trn': getattr(customer, 'trn', '') if customer else '',
        'customer_vat_number': getattr(customer, 'vat_number', '') if customer else '',
        'customer_address': getattr(customer, 'street_address', '') if customer else '',
        'customer_city': getattr(customer, 'city', '') if customer else '',
        'customer_state_province': getattr(customer, 'state_province', '') if customer else '',
        'customer_country': getattr(customer, 'country', 'United Arab Emirates') if customer else 'United Arab Emirates',
        'customer_phone': getattr(customer, 'phone', '') if customer else '',
        'customer_email': getattr(customer, 'email', '') if customer else '',
    }

    # Build items
    items = []
    for item in invoice.items.filter(is_active=True).order_by('sort_order', 'created_at'):
        items.append({
            'id': str(item.id),
            'item_name': getattr(item, 'item_name', '') or '',
            'description': item.description or '',
            'quantity': str(item.quantity),
            'unit': item.unit or '',
            'unit_price': str(item.unit_price),
            'vat_rate_type': item.vat_rate_type or 'standard',
            'vat_rate_type_display': item.get_vat_rate_type_display() if hasattr(item, 'get_vat_rate_type_display') else item.vat_rate_type,
            'vat_rate': str(getattr(item, 'vat_rate', '5.00')),
            'subtotal': str(getattr(item, 'subtotal', '0.00')),
            'vat_amount': str(getattr(item, 'vat_amount', '0.00')),
            'total_amount': str(getattr(item, 'total_amount', '0.00')),
            'sort_order': getattr(item, 'sort_order', 0) or 0,
            'is_active': True,
        })

    # Build the invoice data matching the frontend Invoice interface
    invoice_data = {
        'id': str(invoice.id),
        'invoice_number': invoice.invoice_number or '',
        'invoice_type': invoice.invoice_type or 'tax_invoice',
        'status': invoice.status or 'draft',
        'company_name': company.name or '',
        'company_trn': company.trn or '',
        'company': company_data,
        **customer_data,
        'issue_date': invoice.issue_date.isoformat() if invoice.issue_date else '',
        'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
        'supply_date': invoice.supply_date.isoformat() if invoice.supply_date else None,
        'supply_date_end': invoice.supply_date_end.isoformat() if invoice.supply_date_end else None,
        'currency': invoice.currency or 'AED',
        'subtotal': str(invoice.subtotal or '0.00'),
        'discount_amount': str(invoice.discount_amount or '0.00'),
        'taxable_amount': str(invoice.taxable_amount or '0.00'),
        'total_vat': str(invoice.total_vat or '0.00'),
        'total_amount': str(invoice.total_amount or '0.00'),
        'reference_number': invoice.reference_number or '',
        'purchase_order_number': invoice.purchase_order_number or '',
        'asp_submission_id': invoice.asp_submission_id or '',
        'asp_submitted_at': invoice.asp_submitted_at.isoformat() if invoice.asp_submitted_at else None,
        'payment_means_code': invoice.payment_means_code or '',
        'amount_paid': str(invoice.amount_paid) if invoice.amount_paid else None,
        'items': items,
        'buyer_signed_name': getattr(invoice, 'buyer_signed_name', '') or '',
        'buyer_signature_image': getattr(invoice, 'buyer_signature_image', '') or '',
        'buyer_signed_at': invoice.buyer_signed_at.isoformat() if getattr(invoice, 'buyer_signed_at', None) else None,
        'notes': invoice.notes or '',
        'created_at': invoice.created_at.isoformat() if invoice.created_at else '',
    }

    return invoice_data


def _company_logo_data_uri(company) -> str | None:
    """
    Convert the company logo FileField to a base64 data URI.
    The Node.js PDF renderer needs absolute URLs or data URIs for images.
    """
    logo_field = getattr(company, 'logo', None)
    if not logo_field:
        return None

    try:
        # Read the file content
        logo_field.open('rb')
        content = logo_field.read()
        logo_field.close()

        # Determine content type
        name = getattr(logo_field, 'name', '') or ''
        if name.endswith('.png'):
            mime = 'image/png'
        elif name.endswith(('.jpg', '.jpeg')):
            mime = 'image/jpeg'
        elif name.endswith('.svg'):
            mime = 'image/svg+xml'
        elif name.endswith('.webp'):
            mime = 'image/webp'
        else:
            mime = 'image/png'  # default

        import base64
        b64 = base64.b64encode(content).decode('ascii')
        return f'data:{mime};base64,{b64}'
    except Exception:
        logger.warning('Failed to read company logo for PDF generation', exc_info=True)
        return None


def generate_invoice_pdf(
    invoice,
    qr_code: str | None = None,
    timeout: int = 30,
) -> bytes:
    """
    Generate a PDF for the given invoice using the Node.js @react-pdf renderer.

    Args:
        invoice: Django Invoice model instance (with company/customer prefetched)
        qr_code: Pre-generated QR code as a data URI string.
                  If None, will be generated automatically.
        timeout: Maximum seconds to wait for the Node.js process.

    Returns:
        Raw PDF bytes.

    Raises:
        RuntimeError: If PDF generation fails.
        FileNotFoundError: If the Node.js service is not installed.
    """
    # Ensure npm dependencies are installed
    node_modules = _PDF_SERVICE_DIR / 'node_modules'
    if not node_modules.exists():
        raise FileNotFoundError(
            f'Node.js dependencies not installed in {_PDF_SERVICE_DIR}. '
            f'Run "cd {_PDF_SERVICE_DIR} && npm install" first.'
        )

    # Generate QR code if not provided
    if qr_code is None:
        try:
            from apps.invoices.utils import generate_invoice_qr_base64
            qr_code = generate_invoice_qr_base64(invoice)
        except Exception:
            logger.warning('QR code generation failed for invoice %s', invoice.invoice_number, exc_info=True)
            qr_code = ''

    # Serialize invoice to JSON
    invoice_data = _serialize_invoice(invoice)

    input_payload = json.dumps({
        'invoice': invoice_data,
        'company': invoice_data.get('company', None),  # Not used separately, company is embedded
        'qrCode': qr_code,
    }, default=str)

    node_exec = _get_node_executable()
    tsx_script = _PDF_SERVICE_DIR / 'generate-pdf.ts'

    if not tsx_script.exists():
        raise FileNotFoundError(f'PDF service script not found: {tsx_script}')

    try:
        # Find tsx executable in node_modules
        tsx_bin = _PDF_SERVICE_DIR / 'node_modules' / '.bin' / 'tsx'
        if sys.platform == 'win32':
            tsx_bin = _PDF_SERVICE_DIR / 'node_modules' / '.bin' / 'tsx.cmd'

        if tsx_bin.exists():
            cmd = [str(tsx_bin), str(tsx_script)]
        else:
            # Fallback: use npx to invoke tsx
            cmd = [node_exec, 'npx', '--yes', 'tsx', str(tsx_script)]

        result = subprocess.run(
            cmd,
            input=input_payload.encode('utf-8'),
            capture_output=True,
            timeout=timeout,
            cwd=str(_PDF_SERVICE_DIR),
            env={**os.environ, 'NODE_ENV': 'production'},
        )

        if result.returncode != 0:
            error_msg = result.stderr.decode('utf-8', errors='replace')
            raise RuntimeError(
                f'PDF generation failed (exit code {result.returncode}): {error_msg}'
            )

        pdf_bytes = result.stdout
        if not pdf_bytes or len(pdf_bytes) < 100:
            raise RuntimeError(
                f'PDF generation returned invalid output ({len(pdf_bytes)} bytes)'
            )

        return pdf_bytes

    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f'PDF generation timed out after {timeout}s for invoice {invoice.invoice_number}'
        )
    except FileNotFoundError as e:
        if 'tsx' in str(e) or 'node' in str(e).lower():
            raise FileNotFoundError(
                f'Node.js or tsx not found. Ensure Node.js is installed and '
                f'npm install has been run in {_PDF_SERVICE_DIR}'
            )
        raise


def generate_invoice_pdf_fallback(invoice, **kwargs) -> bytes | None:
    """
    Try to generate PDF using @react-pdf renderer.
    Falls back to xhtml2pdf if the Node.js service is unavailable.

    This provides a graceful degradation path during deployment.
    """
    try:
        return generate_invoice_pdf(invoice, **kwargs)
    except (FileNotFoundError, RuntimeError) as e:
        logger.warning(
            'Node.js PDF service unavailable, falling back to xhtml2pdf: %s', e,
            exc_info=True,
        )
        return _generate_pdf_xhtml2pdf(invoice)


def _generate_pdf_xhtml2pdf(invoice) -> bytes:
    """
    Fallback PDF generation using xhtml2pdf (the old method).
    Used only when the Node.js service is unavailable.
    """
    from io import BytesIO
    from xhtml2pdf import pisa
    from django.template.loader import render_to_string

    items = invoice.items.filter(is_active=True).order_by('sort_order', 'created_at')

    from decimal import Decimal
    paid = invoice.amount_paid or Decimal('0.00')
    balance_due = max(invoice.total_amount - paid, Decimal('0.00')) if paid > 0 else None

    payment_means_label = ''
    if invoice.payment_means_code:
        payment_means_label = invoice.get_payment_means_code_display()

    try:
        from apps.invoices.utils import generate_invoice_qr_base64
        qr_code = generate_invoice_qr_base64(invoice)
    except Exception:
        qr_code = None

    from apps.invoices.utils import parse_invoice_faf_meta
    faf = parse_invoice_faf_meta(invoice.notes)

    html = render_to_string('invoices/invoice_pdf.html', {
        'invoice': invoice,
        'items': items,
        'qr_code': qr_code,
        'balance_due': balance_due,
        'payment_means_label': payment_means_label,
        'permit_number': faf.get('permit_number', ''),
        'transaction_id': faf.get('transaction_id', ''),
        'gl_account_id': faf.get('gl_account_id', ''),
    })

    buf = BytesIO()
    pisa.CreatePDF(html, dest=buf, encoding='utf-8')
    buf.seek(0)
    return buf.read()
