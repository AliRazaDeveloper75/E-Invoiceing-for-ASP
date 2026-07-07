"""
Invoices API views.

Endpoints:
  GET  /api/v1/invoices/?company_id=<uuid>           list with filters
  POST /api/v1/invoices/                             create invoice (+ optional items)
  GET  /api/v1/invoices/{id}/                        retrieve with items
  PUT  /api/v1/invoices/{id}/                        update header (DRAFT only)
  DELETE /api/v1/invoices/{id}/                      soft delete (DRAFT only)
  POST /api/v1/invoices/{id}/submit/                 DRAFT → PENDING
  POST /api/v1/invoices/{id}/cancel/                 cancel (DRAFT/PENDING)
  POST /api/v1/invoices/{id}/validate/               pre-submit validation (no state change)
  POST /api/v1/invoices/{id}/report-fta/             manually trigger FTA re-report
  GET  /api/v1/invoices/{id}/download-xml/           download UBL 2.1 XML file
  GET  /api/v1/invoices/{id}/vat-summary/            VAT breakdown by rate type
  GET  /api/v1/invoices/{id}/items/                  list items
  POST /api/v1/invoices/{id}/items/                  add item
  PUT  /api/v1/invoices/{id}/items/{item_id}/        update item
  DELETE /api/v1/invoices/{id}/items/{item_id}/      remove item
  GET  /api/v1/invoices/dashboard/?company_id=<uuid> dashboard stats
  GET  /api/v1/invoices/export/?company_id=<uuid>    CSV export
  GET  /api/v1/invoices/gap-report/?company_id=<uuid> UAE Art.70 gap detection
"""
import io
import logging
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response, error_response, StandardResultsPagination
from .models import Invoice, InvoiceItem, InvoiceDraft
from .serializers import (
    InvoiceSerializer, InvoiceListSerializer,
    InvoiceCreateSerializer, InvoiceUpdateSerializer,
    InvoiceFilterSerializer,
    InvoiceItemSerializer, InvoiceItemCreateSerializer, InvoiceItemUpdateSerializer,
    InvoiceDraftSerializer,
)
from .services import InvoiceService, InvoiceItemService, VATCalculationService
from .permissions import get_company_and_membership

logger = logging.getLogger(__name__)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _resolve_invoice(request, invoice_id: str):
    """
    Resolve invoice → company → membership.
    Returns (invoice, membership, error_response | None).

    Isolation rule:
      - Admin users can access any invoice.
      - All other roles can only access invoices they created (created_by == user).
    """
    try:
        invoice = Invoice.objects.select_related('company', 'customer').get(
            id=invoice_id, is_active=True
        )
    except Invoice.DoesNotExist:
        return None, None, error_response('Invoice not found.', status_code=status.HTTP_404_NOT_FOUND)

    # Admin users bypass company membership — they can access any invoice
    if getattr(request.user, 'role', None) == 'admin' or request.user.is_staff:
        return invoice, None, None

    company, membership = get_company_and_membership(request.user, invoice.company.id)
    if not company:
        return None, None, error_response('Invoice not found.', status_code=status.HTTP_404_NOT_FOUND)

    # Non-admin users can only access invoices they personally created
    if invoice.created_by_id != request.user.id:
        return None, None, error_response('Invoice not found.', status_code=status.HTTP_404_NOT_FOUND)

    return invoice, membership, None


# ─── Invoice List / Create ────────────────────────────────────────────────────

class InvoiceListCreateView(APIView):
    """
    GET  /api/v1/invoices/?company_id=<uuid>  — paginated list with filters
    POST /api/v1/invoices/                     — create invoice in DRAFT status
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filter_s = InvoiceFilterSerializer(data=request.query_params)
        if not filter_s.is_valid():
            return error_response('Invalid query parameters.', details=filter_s.errors)

        params = filter_s.validated_data
        company, membership = get_company_and_membership(request.user, params['company_id'])
        if not company:
            return error_response('Company not found or you are not a member.',
                                  status_code=status.HTTP_404_NOT_FOUND)

        # Suppliers/accountants/viewers see only their own invoices;
        # admins see all invoices for the company.
        creator_filter = None if request.user.role == 'admin' else request.user

        invoices = InvoiceService.get_company_invoices(
            company=company,
            status=params.get('status'),
            customer_id=params.get('customer_id'),
            invoice_type=params.get('invoice_type'),
            date_from=params.get('date_from'),
            date_to=params.get('date_to'),
            search=params.get('search'),
            created_by=creator_filter,
        )

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(invoices, request)
        return paginator.get_paginated_response(InvoiceListSerializer(page, many=True).data)

    def post(self, request):
        serializer = InvoiceCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invoice creation failed.', details=serializer.errors,
                                  status_code=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        company, membership = get_company_and_membership(request.user, data['company_id'])
        if not company:
            return error_response('Company not found or you are not a member.',
                                  status_code=status.HTTP_404_NOT_FOUND)

        invoice = InvoiceService.create_invoice(
            company=company, membership=membership, data=data
        )
        return success_response(
            data=InvoiceSerializer(invoice).data,
            message='Invoice created successfully.',
            status_code=status.HTTP_201_CREATED
        )


# ─── Invoice Detail ───────────────────────────────────────────────────────────

class InvoiceDetailView(APIView):
    """
    GET    /api/v1/invoices/{id}/  — retrieve invoice with items
    PUT    /api/v1/invoices/{id}/  — update header (DRAFT only)
    DELETE /api/v1/invoices/{id}/  — soft delete (DRAFT only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        invoice, _, err = _resolve_invoice(request, invoice_id)
        if err:
            return err
        return success_response(data=InvoiceSerializer(invoice).data)

    def put(self, request, invoice_id):
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        serializer = InvoiceUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invoice update failed.', details=serializer.errors)

        invoice = InvoiceService.update_invoice(invoice, membership, serializer.validated_data)
        return success_response(
            data=InvoiceSerializer(invoice).data,
            message='Invoice updated successfully.'
        )

    def delete(self, request, invoice_id):
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        if not invoice.is_editable:
            return error_response(
                f'Only DRAFT invoices can be deleted. Current status: "{invoice.status}".',
                status_code=status.HTTP_400_BAD_REQUEST
            )
        if not membership.is_admin:
            return error_response('Only admins can delete invoices.',
                                  status_code=status.HTTP_403_FORBIDDEN)

        invoice.is_active = False
        invoice.save(update_fields=['is_active', 'updated_at'])
        return success_response(message='Invoice deleted.')


# ─── Invoice Status Transitions ───────────────────────────────────────────────

class InvoiceSubmitView(APIView):
    """POST /api/v1/invoices/{id}/submit/ — DRAFT → PENDING"""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        invoice = InvoiceService.submit_invoice(invoice, membership)
        return success_response(
            data=InvoiceSerializer(invoice).data,
            message=f'Invoice {invoice.invoice_number} submitted for processing.'
        )


class InvoiceSendForApprovalView(APIView):
    """
    POST /api/v1/invoices/{id}/send-for-approval/

    Send a DRAFT invoice to the buyer for review + e-signature before it is
    submitted to the ASP. DRAFT → AWAITING_APPROVAL. Notifies the buyer.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        from apps.common.constants import (
            INVOICE_STATUS_DRAFT, INVOICE_STATUS_AWAITING_APPROVAL,
        )
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        if invoice.status != INVOICE_STATUS_DRAFT:
            return error_response(
                f'Only DRAFT invoices can be sent for approval. Current status: "{invoice.status}".',
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if not invoice.items.filter(is_active=True).exists():
            return error_response('Add at least one line item before sending for approval.',
                                  status_code=status.HTTP_400_BAD_REQUEST)
        if not invoice.customer.email:
            return error_response('The customer has no email address — cannot request approval.',
                                  status_code=status.HTTP_400_BAD_REQUEST)

        invoice.status = INVOICE_STATUS_AWAITING_APPROVAL
        invoice.save(update_fields=['status', 'updated_at'])

        # Notify the buyer (portal notification + email) if they have a portal login.
        try:
            from apps.buyers.models import BuyerProfile
            from apps.notifications.services import NotificationService
            from apps.notifications.models import Notification
            profile = BuyerProfile.objects.filter(customer=invoice.customer, is_active=True).first()
            if profile:
                NotificationService.notify(
                    profile.user, category=Notification.CAT_INVOICE,
                    event='approval_requested',
                    title=f'Approval requested — {invoice.invoice_number}',
                    message='A supplier has sent you an invoice to review and approve.',
                    link=f'/buyer/invoices/{invoice.id}',
                )
            # Email the buyer regardless (portal invite link).
            from apps.invoices.services import _send_buyer_invoice_email
            _send_buyer_invoice_email(invoice)
        except Exception:
            logger.warning('send-for-approval: buyer notification failed for %s', invoice.invoice_number)

        return success_response(
            data=InvoiceSerializer(invoice).data,
            message=f'Invoice {invoice.invoice_number} sent to the buyer for approval.',
        )


class InvoiceCancelView(APIView):
    """POST /api/v1/invoices/{id}/cancel/ — DRAFT|PENDING → CANCELLED"""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        invoice = InvoiceService.cancel_invoice(invoice, membership)
        return success_response(
            data=InvoiceSerializer(invoice).data,
            message=f'Invoice {invoice.invoice_number} has been cancelled.'
        )


class InvoiceDeactivateView(APIView):
    """POST /api/v1/invoices/{id}/deactivate/ — deactivate an invoice with a reason."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        reason = (request.data.get('reason') or '').strip()
        invoice = InvoiceService.deactivate_invoice(invoice, membership, reason)
        return success_response(
            data=InvoiceSerializer(invoice).data,
            message=f'Invoice {invoice.invoice_number} has been deactivated.'
        )


class InvoiceCreditNoteView(APIView):
    """POST /api/v1/invoices/{id}/credit-note/ — issue a credit note against an invoice."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        credit = InvoiceService.create_credit_note(invoice, membership)
        return success_response(
            data=InvoiceSerializer(credit).data,
            message=f'Credit note {credit.invoice_number} created for {invoice.invoice_number}.',
            status_code=status.HTTP_201_CREATED,
        )


class InvoiceVATSummaryView(APIView):
    """GET /api/v1/invoices/{id}/vat-summary/ — VAT breakdown by rate type"""
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        invoice, _, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        summary = VATCalculationService.get_vat_summary(invoice)
        return success_response(data={
            'invoice_number': invoice.invoice_number,
            'currency':       invoice.currency,
            'subtotal':       str(invoice.subtotal),
            'discount':       str(invoice.discount_amount),
            'taxable_amount': str(invoice.taxable_amount),
            'total_vat':      str(invoice.total_vat),
            'total_amount':   str(invoice.total_amount),
            'vat_breakdown':  list(summary.values()),
        })


# ─── Invoice Items ────────────────────────────────────────────────────────────

class InvoiceItemListCreateView(APIView):
    """
    GET  /api/v1/invoices/{id}/items/  — list active items
    POST /api/v1/invoices/{id}/items/  — add item (DRAFT only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        invoice, _, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        items = invoice.items.filter(is_active=True).order_by('sort_order')
        return success_response(data=InvoiceItemSerializer(items, many=True).data)

    def post(self, request, invoice_id):
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        serializer = InvoiceItemCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Add item failed.', details=serializer.errors)

        item = InvoiceItemService.add_item(invoice, membership, serializer.validated_data)
        return success_response(
            data=InvoiceItemSerializer(item).data,
            message='Item added to invoice.',
            status_code=status.HTTP_201_CREATED
        )


class InvoiceItemDetailView(APIView):
    """
    PUT    /api/v1/invoices/{id}/items/{item_id}/  — update item
    DELETE /api/v1/invoices/{id}/items/{item_id}/  — remove item
    """
    permission_classes = [IsAuthenticated]

    def _get_item(self, invoice, item_id: str):
        return get_object_or_404(InvoiceItem, id=item_id, invoice=invoice, is_active=True)

    def put(self, request, invoice_id, item_id):
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err
        item = self._get_item(invoice, item_id)

        serializer = InvoiceItemUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Item update failed.', details=serializer.errors)

        item = InvoiceItemService.update_item(item, invoice, membership, serializer.validated_data)
        return success_response(
            data=InvoiceItemSerializer(item).data,
            message='Item updated.'
        )

    def delete(self, request, invoice_id, item_id):
        invoice, membership, err = _resolve_invoice(request, invoice_id)
        if err:
            return err
        item = self._get_item(invoice, item_id)

        InvoiceItemService.remove_item(item, invoice, membership)
        return success_response(message='Item removed from invoice.')


# ─── XML Download ─────────────────────────────────────────────────────────────

class InvoiceXMLDownloadView(APIView):
    """
    GET /api/v1/invoices/{id}/download-xml/

    Streams the generated UBL 2.1 XML file for a submitted/validated invoice.

    Only available once the async pipeline has generated the XML (xml_file is set).
    Returns 404 if the invoice has no XML yet (still DRAFT or PENDING).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        invoice, _, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        filename = f'{invoice.invoice_number}.xml'
        try:
            if invoice.xml_file:
                # Use the stored, pipeline-generated XML when available.
                xml_bytes = invoice.xml_file.read()
            else:
                # Generate the UBL 2.1 XML on-the-fly (drafts / not-yet-processed),
                # mirroring the PDF download which is available for all statuses.
                from services.xml_generator import UAEInvoiceXMLGenerator
                xml_bytes = UAEInvoiceXMLGenerator().generate(invoice)
            response = HttpResponse(xml_bytes, content_type='application/xml')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception:
            logger.exception('Failed to produce XML for invoice %s', invoice.invoice_number)
            return error_response('XML could not be generated for this invoice.', status_code=500)


# ─── PDF Download ─────────────────────────────────────────────────────────────

class InvoicePDFDownloadView(APIView):
    """
    GET /api/v1/invoices/{id}/download-pdf/

    Generates and streams a human-readable PDF for any invoice (Visual Invoice).
    Available for all statuses — the PDF is generated on-the-fly from invoice data.
    This is the document delivered to Corner 4 (Buyer) alongside the UBL XML.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        try:
            from xhtml2pdf import pisa
        except ImportError:
            return error_response(
                'PDF generation is not available. Install xhtml2pdf.',
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
            )

        invoice, _, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        items = invoice.items.filter(is_active=True).order_by('sort_order', 'created_at')

        from apps.invoices.utils import generate_invoice_qr_base64
        qr_code = generate_invoice_qr_base64(invoice)

        try:
            html = render_to_string('invoices/invoice_pdf.html', {
                'invoice': invoice,
                'items': items,
                'qr_code': qr_code,
            })
        except Exception as exc:
            logger.exception('Template rendering failed for invoice %s', invoice_id)
            return error_response(f'PDF template error: {exc}', status_code=500)

        buffer = io.BytesIO()
        try:
            result = pisa.CreatePDF(html, dest=buffer, encoding='utf-8')
        except Exception as exc:
            logger.exception('pisa.CreatePDF raised an exception for invoice %s', invoice_id)
            return error_response(f'PDF engine error: {exc}', status_code=500)

        if result.err:
            logger.error('PDF generation failed for invoice %s (err=%s)', invoice.invoice_number, result.err)
            return error_response(f'PDF could not be generated (err={result.err}).', status_code=500)

        buffer.seek(0)
        filename = f'{invoice.invoice_number}.pdf'
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


# ─── Dashboard ────────────────────────────────────────────────────────────────

class InvoiceDashboardView(APIView):
    """
    GET /api/v1/invoices/dashboard/?company_id=<uuid>

    Returns aggregated stats for the company dashboard:
      - Total invoice count
      - Status breakdown (draft/pending/submitted/validated/rejected/cancelled/paid)
      - Total confirmed revenue (validated + paid invoices)
      - Total VAT collected
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get('company_id')
        if not company_id:
            return error_response('company_id query parameter is required.',
                                  status_code=status.HTTP_400_BAD_REQUEST)

        company, _ = get_company_and_membership(request.user, company_id)
        if not company:
            return error_response('Company not found or you are not a member.',
                                  status_code=status.HTTP_404_NOT_FOUND)

        creator_filter = None if request.user.role == 'admin' else request.user
        stats = InvoiceService.get_dashboard_stats(company, created_by=creator_filter)
        return success_response(data={
            'company_id':        str(company.id),
            'company_name':      company.name,
            'total_invoices':    stats['total_invoices'],
            'status_breakdown':  stats['status_breakdown'],
            'total_revenue':     str(stats['total_revenue']),
            'total_vat':         str(stats['total_vat']),
        })


# ─── Pre-Submit Validation ────────────────────────────────────────────────────

class InvoiceValidateView(APIView):
    """
    POST /api/v1/invoices/{id}/validate/

    Run the full validation pipeline on an invoice WITHOUT changing its status.
    Returns detailed errors/warnings so the user can fix issues before submitting.

    Runs:
      1. InvoiceValidationService (UAE business rules)
      2. FullPEPPOLValidator (XSD + Schematron) — on generated XML

    Does NOT change invoice status. Safe to call repeatedly.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        invoice, _, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        errors   = []
        warnings = []

        # Layer 1: Business rule validation
        try:
            from services.validation_service import InvoiceValidationService
            result = InvoiceValidationService().validate(invoice)
            errors.extend(result.errors)
            warnings.extend(result.warnings)
        except Exception as exc:
            logger.exception('Validation service error for %s', invoice.invoice_number)
            return error_response(f'Validation service error: {exc}', status_code=500)

        # Layer 2: PEPPOL XML validation (generate XML first)
        peppol_errors   = []
        peppol_warnings = []
        if not errors:  # Only run PEPPOL validation if basic validation passes
            try:
                from services.xml_generator import UAEInvoiceXMLGenerator
                from services.peppol_validator import FullPEPPOLValidator
                from apps.invoices.services import VATCalculationService

                VATCalculationService.recalculate_invoice_totals(invoice)
                invoice.refresh_from_db()

                xml_bytes = UAEInvoiceXMLGenerator().generate(invoice)
                peppol_result = FullPEPPOLValidator().validate(
                    xml_bytes, invoice_type=invoice.invoice_type
                )
                peppol_errors.extend(peppol_result.errors)
                peppol_warnings.extend(peppol_result.warnings)
            except Exception as exc:
                logger.warning('PEPPOL validation error for %s: %s', invoice.invoice_number, exc)
                peppol_warnings.append(f'PEPPOL validation skipped: {exc}')

        is_valid = not errors and not peppol_errors
        return success_response(data={
            'invoice_number':   invoice.invoice_number,
            'is_valid':         is_valid,
            'errors':           errors,
            'warnings':         warnings,
            'peppol_errors':    peppol_errors,
            'peppol_warnings':  peppol_warnings,
            'can_submit':       is_valid and invoice.is_submittable,
        })


# ─── Manual FTA Re-Report ─────────────────────────────────────────────────────

class InvoiceFTAReportView(APIView):
    """
    POST /api/v1/invoices/{id}/report-fta/

    Manually trigger FTA reporting for a validated invoice.
    Use this when automatic FTA reporting failed (fta_status='error').
    Admin only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_id):
        if request.user.role != 'admin':
            return error_response('Platform admin access required.', status_code=403)

        invoice, _, err = _resolve_invoice(request, invoice_id)
        if err:
            return err

        if invoice.status not in ('validated', 'paid'):
            return error_response(
                f'Invoice must be validated or paid. Current status: {invoice.status}.',
                status_code=400
            )

        from tasks.fta_tasks import report_invoice_to_fta
        from apps.invoices.models import Invoice

        # Reset status to pending before re-queuing
        Invoice.objects.filter(pk=invoice.pk).update(fta_status='pending')

        task = report_invoice_to_fta.apply_async(
            args=[str(invoice.id)],
            queue='celery',
        )
        return success_response(
            data={'task_id': str(task.id), 'invoice_number': invoice.invoice_number},
            message='FTA report re-queued successfully.'
        )


# ─── Invoice CSV Export ───────────────────────────────────────────────────────

class InvoiceExportView(APIView):
    """
    GET /api/v1/invoices/export/?company_id=<uuid>

    Export all invoices for a company as CSV.
    Supports the same filters as InvoiceListCreateView.

    Optional: ?status=validated&date_from=2026-01-01&date_to=2026-03-31
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import csv as _csv

        company_id = request.query_params.get('company_id')
        if not company_id:
            return error_response('company_id is required.', status_code=400)

        company, _ = get_company_and_membership(request.user, company_id)
        if not company:
            return error_response('Company not found or access denied.', status_code=404)

        creator_filter = None if request.user.role == 'admin' else request.user
        invoices = InvoiceService.get_company_invoices(
            company=company,
            status=request.query_params.get('status'),
            date_from=request.query_params.get('date_from'),
            date_to=request.query_params.get('date_to'),
            search=request.query_params.get('search'),
            created_by=creator_filter,
        ).select_related('customer')

        output = io.StringIO()
        writer = _csv.writer(output)

        writer.writerow([
            'Invoice Number', 'Type', 'Status', 'Customer', 'Customer TRN',
            'Issue Date', 'Due Date', 'Currency',
            'Subtotal', 'Discount', 'Taxable Amount', 'VAT', 'Total Amount',
            'ASP Submission ID', 'FTA Reference', 'FTA Status',
            'XML Generated', 'Created At',
        ])

        for inv in invoices:
            writer.writerow([
                inv.invoice_number,
                inv.get_invoice_type_display(),
                inv.get_status_display(),
                inv.customer.name,
                getattr(inv.customer, 'trn', ''),
                str(inv.issue_date),
                str(inv.due_date) if inv.due_date else '',
                inv.currency,
                str(inv.subtotal),
                str(inv.discount_amount),
                str(inv.taxable_amount),
                str(inv.total_vat),
                str(inv.total_amount),
                inv.asp_submission_id,
                inv.fta_reference,
                inv.fta_status or '',
                inv.xml_generated_at.isoformat() if inv.xml_generated_at else '',
                inv.created_at.isoformat(),
            ])

        csv_content = output.getvalue().encode('utf-8-sig')  # BOM for Excel
        filename = f'invoices_{company.trn}.csv'
        response = HttpResponse(csv_content, content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


# ─── Invoice Gap Detection (UAE Article 70) ──────────────────────────────────

class InvoiceGapReportView(APIView):
    """
    GET /api/v1/invoices/gap-report/?company_id=<uuid>

    UAE Article 70: invoice numbers must be consecutive per company.
    Returns any gaps in the invoice sequence for compliance auditing.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get('company_id')
        if not company_id:
            return error_response('company_id is required.', status_code=400)

        company, _ = get_company_and_membership(request.user, company_id)
        if not company:
            return error_response('Company not found or access denied.', status_code=404)

        from .services import InvoiceNumberService
        gaps = InvoiceNumberService.detect_gaps(company)

        return success_response(data={
            'company':        company.name,
            'company_trn':    company.trn,
            'gap_count':      len(gaps),
            'gaps':           gaps,
            'compliant':      len(gaps) == 0,
            'message': (
                'Invoice numbering is compliant with UAE Article 70.'
                if not gaps
                else f'{len(gaps)} gap(s) detected in invoice sequence. Investigate immediately.'
            ),
        })


class InvoiceDraftAutosaveView(APIView):
    """
    Server-side autosave scratchpad for an in-progress invoice form.

    GET    /api/v1/invoices/draft-autosave/?company_id=<uuid>&form_type=pint
           → { exists, payload, updated_at }  (cross-device resume)
    PUT    /api/v1/invoices/draft-autosave/   body: { company_id, form_type, payload }
           → upsert the draft snapshot
    DELETE /api/v1/invoices/draft-autosave/?company_id=<uuid>&form_type=pint
           → drop the draft (call after the invoice is created)

    Stores the raw form JSON only — never creates a real Invoice, so partial data
    (no customer / no items) is fine. Scoped to the authenticated user + company.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get('company_id')
        form_type  = request.query_params.get('form_type', 'pint')
        company, membership = get_company_and_membership(request.user, company_id)
        if not company:
            return error_response('Company not found or access denied.', status_code=403)
        draft = InvoiceDraft.objects.filter(
            user=request.user, company=company, form_type=form_type,
        ).first()
        if not draft:
            return success_response(data={'exists': False})
        return success_response(data={
            'exists': True,
            'payload': draft.payload,
            'updated_at': draft.updated_at,
        })

    def put(self, request):
        serializer = InvoiceDraftSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid draft.', details=serializer.errors, status_code=400)
        d = serializer.validated_data
        company, membership = get_company_and_membership(request.user, str(d['company_id']))
        if not company:
            return error_response('Company not found or access denied.', status_code=403)
        InvoiceDraft.objects.update_or_create(
            user=request.user, company=company, form_type=d['form_type'],
            defaults={'payload': d['payload']},
        )
        return success_response(message='Draft saved.', status_code=200)

    def delete(self, request):
        company_id = request.query_params.get('company_id')
        form_type  = request.query_params.get('form_type', 'pint')
        company, membership = get_company_and_membership(request.user, company_id)
        if not company:
            return error_response('Company not found or access denied.', status_code=403)
        InvoiceDraft.objects.filter(
            user=request.user, company=company, form_type=form_type,
        ).delete()
        return success_response(message='Draft cleared.', status_code=200)
