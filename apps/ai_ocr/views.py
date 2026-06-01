"""
AI OCR API Views.

POST /api/v1/ocr/upload/        — upload document, enqueue OCR task
GET  /api/v1/ocr/               — list user's OCR documents
GET  /api/v1/ocr/<uuid>/        — get document + extraction result
PUT  /api/v1/ocr/<uuid>/review/ — user reviews/confirms extracted data
DELETE /api/v1/ocr/<uuid>/      — delete document
"""
import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.utils import success_response, error_response, StandardResultsPagination
from .models import OCRDocument, OCRResult

logger = logging.getLogger(__name__)

ALLOWED_MIMES = {
    'application/pdf': 'application/pdf',
    'image/png':  'image/png',
    'image/jpeg': 'image/jpeg',
    'image/jpg':  'image/jpeg',
    'image/webp': 'image/png',
}
MAX_FILE_SIZE_MB = 25


def _serialize_doc(doc: OCRDocument, include_result: bool = True) -> dict:
    data: dict = {
        'id':            str(doc.id),
        'original_name': doc.original_name,
        'mime_type':     doc.mime_type,
        'file_size_bytes': doc.file_size_bytes,
        'status':        doc.status,
        'error_detail':  doc.error_detail,
        'created_at':    doc.created_at.isoformat(),
        'processing_duration_ms': doc.processing_duration_ms,
        'linked_invoice_id': str(doc.linked_invoice_id) if doc.linked_invoice_id else None,
    }

    if include_result and hasattr(doc, 'result'):
        r = doc.result
        data['result'] = {
            'supplier_name':    r.supplier_name,
            'supplier_trn':     r.supplier_trn,
            'supplier_address': r.supplier_address,
            'customer_name':    r.customer_name,
            'customer_trn':     r.customer_trn,
            'customer_address': r.customer_address,
            'invoice_number':   r.invoice_number,
            'invoice_type':     r.invoice_type,
            'issue_date':       str(r.issue_date) if r.issue_date else None,
            'due_date':         str(r.due_date)   if r.due_date   else None,
            'supply_date':      str(r.supply_date) if r.supply_date else None,
            'currency':         r.currency,
            'subtotal':         float(r.subtotal)      if r.subtotal      else None,
            'total_vat':        float(r.total_vat)     if r.total_vat     else None,
            'total_amount':     float(r.total_amount)  if r.total_amount  else None,
            'vat_rate':         float(r.vat_rate)      if r.vat_rate      else None,
            'payment_terms':    r.payment_terms,
            'purchase_order':   r.purchase_order,
            'notes':            r.notes,
            'line_items':       r.line_items_json,
            'confidence': {
                'overall':      r.confidence_overall,
                'supplier_trn': r.confidence_supplier_trn,
                'customer_trn': r.confidence_customer_trn,
                'amounts':      r.confidence_amounts,
                'dates':        r.confidence_dates,
                'line_items':   r.confidence_line_items,
            },
            'warnings':      r.warnings,
            'provider_used': r.provider_used,
            'needs_review':  r.needs_review,
            'is_reviewed':   r.is_reviewed,
            'reviewed_at':   r.reviewed_at.isoformat() if r.reviewed_at else None,
        }
    else:
        data['result'] = None

    return data


class OCRUploadView(APIView):
    """
    POST /api/v1/ocr/upload/
    Upload a PDF/image invoice for AI OCR extraction.
    Returns immediately with document ID; processing is async via Celery.
    """
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return error_response('No file uploaded. Send as multipart field "file".',
                                  status_code=status.HTTP_400_BAD_REQUEST)

        # Validate MIME
        mime = file.content_type or ''
        normalized = ALLOWED_MIMES.get(mime)
        if not normalized:
            return error_response(
                f'Unsupported file type "{mime}". Allowed: PDF, PNG, JPG.',
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        # Validate size
        if file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
            return error_response(
                f'File too large. Maximum size is {MAX_FILE_SIZE_MB} MB.',
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        # Resolve company
        company_id = request.data.get('company_id') or request.query_params.get('company_id')
        company = None
        if company_id:
            from apps.companies.models import Company
            try:
                company = Company.objects.get(id=company_id, is_active=True)
            except Company.DoesNotExist:
                pass

        doc = OCRDocument.objects.create(
            uploaded_by=request.user,
            company=company,
            file=file,
            original_name=file.name[:255],
            mime_type=normalized,
            file_size_bytes=file.size,
            status=OCRDocument.STATUS_UPLOADED,
        )

        # Enqueue async OCR task
        try:
            from tasks.ocr_tasks import process_ocr_document
            process_ocr_document.apply_async(
                args=[str(doc.id)],
                queue='ocr_processing',
                countdown=1,
            )
        except Exception as exc:
            logger.warning('Celery unavailable — running OCR synchronously: %s', exc)
            try:
                from tasks.ocr_tasks import process_ocr_document
                process_ocr_document.apply(args=[str(doc.id)])
            except Exception as exc2:
                logger.error('Synchronous OCR also failed: %s', exc2)

        logger.info('OCR document queued: %s (%s) by %s',
                    doc.original_name, doc.id, request.user.email)

        return success_response(
            data=_serialize_doc(doc, include_result=False),
            message='Document uploaded. AI extraction started.',
            status_code=status.HTTP_202_ACCEPTED,
        )


class OCRDocumentListView(APIView):
    """GET /api/v1/ocr/ — list documents uploaded by the current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = OCRDocument.objects.filter(
            uploaded_by=request.user,
            is_active=True,
        ).select_related('result').order_by('-created_at')

        status_filter = request.query_params.get('status', '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        company_id = request.query_params.get('company_id', '').strip()
        if company_id:
            qs = qs.filter(company_id=company_id)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        data = [_serialize_doc(doc) for doc in page]

        return success_response(data={
            'results': data,
            'pagination': {
                'count':    paginator.page.paginator.count,
                'next':     paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
            },
        })


class OCRDocumentDetailView(APIView):
    """GET/DELETE /api/v1/ocr/<uuid>/"""
    permission_classes = [IsAuthenticated]

    def _get_doc(self, pk, user):
        return get_object_or_404(
            OCRDocument.objects.select_related('result'),
            id=pk,
            uploaded_by=user,
            is_active=True,
        )

    def get(self, request, pk):
        doc = self._get_doc(pk, request.user)
        return success_response(data=_serialize_doc(doc))

    def delete(self, request, pk):
        doc = self._get_doc(pk, request.user)
        doc.is_active = False
        doc.save(update_fields=['is_active', 'updated_at'])
        return success_response(message='Document deleted.')


class OCRReviewView(APIView):
    """
    PUT /api/v1/ocr/<uuid>/review/
    User confirms or corrects the extracted data.
    Optionally links to an invoice.
    """
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        doc = get_object_or_404(
            OCRDocument.objects.select_related('result'),
            id=pk,
            uploaded_by=request.user,
            is_active=True,
        )

        if doc.status not in (OCRDocument.STATUS_COMPLETED, OCRDocument.STATUS_REVIEWED):
            return error_response(
                'Document is still processing or failed. Cannot review yet.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not hasattr(doc, 'result'):
            return error_response('No extraction result found.', status_code=404)

        r   = doc.result
        d   = request.data
        now = timezone.now()

        # Apply user corrections to editable fields
        editable = [
            'supplier_name', 'supplier_trn', 'supplier_address',
            'customer_name', 'customer_trn', 'customer_address',
            'invoice_number', 'invoice_type', 'currency',
            'payment_terms', 'purchase_order', 'notes',
        ]
        for field in editable:
            if field in d:
                setattr(r, field, d[field])

        for date_field in ('issue_date', 'due_date', 'supply_date'):
            if date_field in d and d[date_field]:
                setattr(r, date_field, d[date_field])

        for amt_field in ('subtotal', 'total_vat', 'total_amount', 'vat_rate'):
            if amt_field in d and d[amt_field] is not None:
                setattr(r, amt_field, d[amt_field])

        if 'line_items' in d:
            r.line_items_json = d['line_items']

        r.is_reviewed  = True
        r.reviewed_by  = request.user
        r.reviewed_at  = now
        r.save()

        doc.status = OCRDocument.STATUS_REVIEWED
        if 'linked_invoice_id' in d and d['linked_invoice_id']:
            doc.linked_invoice_id = d['linked_invoice_id']
        doc.save(update_fields=['status', 'linked_invoice_id', 'updated_at'])

        return success_response(
            data=_serialize_doc(doc),
            message='Review saved successfully.',
        )


class OCRRetryView(APIView):
    """POST /api/v1/ocr/<uuid>/retry/ — re-queue a failed OCR document."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        doc = get_object_or_404(
            OCRDocument,
            id=pk,
            uploaded_by=request.user,
            is_active=True,
        )
        if doc.status not in (OCRDocument.STATUS_FAILED, OCRDocument.STATUS_UPLOADED):
            return error_response(
                'Only failed or uploaded documents can be retried.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        doc.status       = OCRDocument.STATUS_UPLOADED
        doc.error_detail = ''
        doc.save(update_fields=['status', 'error_detail', 'updated_at'])

        from tasks.ocr_tasks import process_ocr_document
        process_ocr_document.apply_async(args=[str(doc.id)], queue='ocr_processing')

        return success_response(message='OCR retry queued.')
