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
  GET  /api/v1/invoices/{id}/download-xml/           download UBL 2.1 XML file
  GET  /api/v1/invoices/{id}/vat-summary/            VAT breakdown by rate type
  GET  /api/v1/invoices/{id}/items/                  list items
  POST /api/v1/invoices/{id}/items/                  add item
  PUT  /api/v1/invoices/{id}/items/{item_id}/        update item
  DELETE /api/v1/invoices/{id}/items/{item_id}/      remove item
  GET  /api/v1/invoices/dashboard/?company_id=<uuid> dashboard stats
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
from .models import Invoice, InvoiceItem
from .serializers import (
    InvoiceSerializer, InvoiceListSerializer,
    InvoiceCreateSerializer, InvoiceUpdateSerializer,
    InvoiceFilterSerializer,
    InvoiceItemSerializer, InvoiceItemCreateSerializer, InvoiceItemUpdateSerializer,
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
    if request.user.role == 'admin':
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

        if not invoice.xml_file:
            return error_response(
                'XML has not been generated for this invoice yet. '
                'The invoice must be submitted and processed before XML is available.',
                status_code=status.HTTP_404_NOT_FOUND,
            )

        filename = f'{invoice.invoice_number}.xml'
        try:
            response = HttpResponse(
                invoice.xml_file.read(),
                content_type='application/xml',
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception:
            logger.exception('Failed to read XML file for invoice %s', invoice.invoice_number)
            return error_response('XML file could not be read.', status_code=500)


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

        html = render_to_string('invoices/invoice_pdf.html', {
            'invoice': invoice,
            'items': items,
        })

        buffer = io.BytesIO()
        pdf_result = pisa.CreatePDF(
            html,
            dest=buffer,
            page_size='A4',
            margin_top='12mm',
            margin_right='14mm',
            margin_bottom='14mm',
            margin_left='14mm',
        )

        if pdf_result.err:
            logger.error('PDF generation failed for invoice %s', invoice.invoice_number)
            return error_response('PDF could not be generated.', status_code=500)

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
