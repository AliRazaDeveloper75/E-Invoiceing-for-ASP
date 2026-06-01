"""
Reporting API views.

  POST /api/v1/reports/faf/generate/          — generate FAF for a period
  GET  /api/v1/reports/faf/                   — list generated FAFs for a company
  GET  /api/v1/reports/faf/{id}/download/     — download FAF file
  POST /api/v1/reports/faf/{id}/submit/       — trigger FTA submission
  GET  /api/v1/reports/audit-logs/            — query invoice audit trail
  GET  /api/v1/reports/api-logs/              — query API request logs (admin only)
"""
import csv
import io
import logging
from datetime import date

from django.http import HttpResponse, FileResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.utils import success_response, error_response, StandardResultsPagination
from apps.companies.permissions import IsCompanyAdmin
from apps.invoices.permissions import get_company_and_membership
from apps.invoices.models import InvoiceAuditLog

logger = logging.getLogger(__name__)


# ─── FAF Generation ───────────────────────────────────────────────────────────

class FAFGenerateView(APIView):
    """
    POST /api/v1/reports/faf/generate/

    Generate a UAE FTA Audit File (FAF) for a company and VAT period.
    Only Company Admins can generate FAFs.

    Request body:
      {
        "company_id": "<uuid>",
        "period_start": "2026-01-01",
        "period_end":   "2026-03-31"
      }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        company_id   = request.data.get('company_id')
        period_start = request.data.get('period_start')
        period_end   = request.data.get('period_end')

        if not all([company_id, period_start, period_end]):
            return error_response(
                'company_id, period_start, and period_end are required.',
                status_code=400
            )

        company, membership = get_company_and_membership(request.user, company_id)
        if not company:
            return error_response('Company not found or access denied.', status_code=404)

        if not membership or membership.role not in ('admin',):
            return error_response(
                'Only company admins can generate FAF reports.',
                status_code=403
            )

        # Parse dates
        try:
            start = date.fromisoformat(period_start)
            end   = date.fromisoformat(period_end)
        except ValueError:
            return error_response(
                'Invalid date format. Use YYYY-MM-DD.',
                status_code=400
            )

        if start > end:
            return error_response('period_start must be before period_end.', status_code=400)

        from services.faf_generator import FAFGenerator
        faf = FAFGenerator.generate(company, start, end, user=request.user)

        return success_response(
            data={
                'id':                str(faf.id),
                'company':           company.name,
                'period_start':      str(faf.period_start),
                'period_end':        str(faf.period_end),
                'status':            faf.status,
                'invoice_count':     faf.invoice_count,
                'credit_note_count': faf.credit_note_count,
                'total_vat_amount':  str(faf.total_vat_amount),
                'file_url':          request.build_absolute_uri(faf.file.url) if faf.file else None,
            },
            message=f'FAF generated: {faf.invoice_count} invoices, VAT total = {faf.total_vat_amount} AED.',
            status_code=201,
        )


class FAFListView(APIView):
    """
    GET /api/v1/reports/faf/?company_id=<uuid>

    List all generated FAFs for a company.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get('company_id')
        if not company_id:
            return error_response('company_id is required.', status_code=400)

        company, _ = get_company_and_membership(request.user, company_id)
        if not company:
            return error_response('Company not found.', status_code=404)

        from apps.reporting.models import FATAuditFile
        fafs = FATAuditFile.objects.filter(company=company).order_by('-period_end')

        data = [
            {
                'id':                str(f.id),
                'period_start':      str(f.period_start),
                'period_end':        str(f.period_end),
                'status':            f.status,
                'invoice_count':     f.invoice_count,
                'credit_note_count': f.credit_note_count,
                'total_vat_amount':  str(f.total_vat_amount),
                'fta_reference':     f.fta_reference,
                'submitted_at':      f.submitted_at.isoformat() if f.submitted_at else None,
                'created_at':        f.created_at.isoformat(),
            }
            for f in fafs
        ]
        return success_response(data=data)


class FAFDownloadView(APIView):
    """
    GET /api/v1/reports/faf/{faf_id}/download/

    Download the FAF CSV file.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, faf_id):
        from apps.reporting.models import FATAuditFile
        try:
            faf = FATAuditFile.objects.select_related('company').get(id=faf_id)
        except FATAuditFile.DoesNotExist:
            return error_response('FAF not found.', status_code=404)

        company, _ = get_company_and_membership(request.user, str(faf.company_id))
        if not company:
            return error_response('Access denied.', status_code=404)

        if not faf.file:
            return error_response('FAF file has not been generated yet.', status_code=404)

        filename = f'FAF_{faf.company.trn}_{faf.period_start}_{faf.period_end}.csv'
        response = HttpResponse(faf.file.read(), content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


# ─── Invoice Audit Log ────────────────────────────────────────────────────────

class InvoiceAuditLogView(APIView):
    """
    GET /api/v1/reports/audit-logs/?invoice_id=<uuid>&company_id=<uuid>

    Query the invoice audit trail for a specific invoice or all invoices
    in a company. Returns entries in descending timestamp order.

    Optional filters: ?action=submitted&from=2026-01-01&to=2026-03-31
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        invoice_id = request.query_params.get('invoice_id')
        company_id = request.query_params.get('company_id')

        if not company_id:
            return error_response('company_id is required.', status_code=400)

        company, _ = get_company_and_membership(request.user, company_id)
        if not company:
            return error_response('Company not found or access denied.', status_code=404)

        qs = InvoiceAuditLog.objects.select_related(
            'performed_by', 'invoice'
        ).filter(invoice__company=company)

        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)

        action_filter = request.query_params.get('action')
        if action_filter:
            qs = qs.filter(action=action_filter)

        from_date = request.query_params.get('from')
        to_date   = request.query_params.get('to')
        if from_date:
            qs = qs.filter(timestamp__date__gte=from_date)
        if to_date:
            qs = qs.filter(timestamp__date__lte=to_date)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)

        data = [
            {
                'id':                 entry.id,
                'invoice_number':     entry.invoice.invoice_number,
                'action':             entry.action,
                'performed_by_email': entry.performed_by_email or (
                    entry.performed_by.email if entry.performed_by else 'system'
                ),
                'field_name':         entry.field_name,
                'old_value':          entry.old_value,
                'new_value':          entry.new_value,
                'description':        entry.description,
                'ip_address':         str(entry.ip_address) if entry.ip_address else None,
                'request_id':         entry.request_id,
                'timestamp':          entry.timestamp.isoformat(),
            }
            for entry in page
        ]
        return paginator.get_paginated_response(data)


# ─── API Request Logs (Admin only) ───────────────────────────────────────────

class APIRequestLogView(APIView):
    """
    GET /api/v1/reports/api-logs/

    Query API request logs. Platform admin only.
    Supports filters: ?status_code=200&path=/api/v1/invoices&from=2026-01-01
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return error_response('Platform admin access required.', status_code=403)

        from apps.reporting.models import APIRequestLog
        qs = APIRequestLog.objects.select_related('user').order_by('-timestamp')

        # Filters
        status_filter = request.query_params.get('status_code')
        if status_filter:
            qs = qs.filter(status_code=status_filter)

        path_filter = request.query_params.get('path')
        if path_filter:
            qs = qs.filter(path__startswith=path_filter)

        user_filter = request.query_params.get('user_id')
        if user_filter:
            qs = qs.filter(user_id=user_filter)

        ip_filter = request.query_params.get('ip')
        if ip_filter:
            qs = qs.filter(ip_address=ip_filter)

        from_date = request.query_params.get('from')
        to_date   = request.query_params.get('to')
        if from_date:
            qs = qs.filter(timestamp__date__gte=from_date)
        if to_date:
            qs = qs.filter(timestamp__date__lte=to_date)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)

        data = [
            {
                'id':           entry.id,
                'method':       entry.method,
                'path':         entry.path,
                'status_code':  entry.status_code,
                'duration_ms':  entry.duration_ms,
                'ip_address':   str(entry.ip_address) if entry.ip_address else None,
                'user_email':   entry.user.email if entry.user else None,
                'request_id':   entry.request_id,
                'timestamp':    entry.timestamp.isoformat(),
            }
            for entry in page
        ]
        return paginator.get_paginated_response(data)
