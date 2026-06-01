"""
Fraud Detection API Views.

POST /api/v1/invoices/<uuid>/fraud/analyze/  — trigger analysis (async)
GET  /api/v1/invoices/<uuid>/fraud/          — get alert for one invoice
PUT  /api/v1/invoices/<uuid>/fraud/resolve/  — resolve / dismiss alert
GET  /api/v1/fraud/alerts/                   — list all alerts (company-scoped)
"""
import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.utils import success_response, error_response, StandardResultsPagination
from .models import Invoice, InvoiceFraudAlert

logger = logging.getLogger(__name__)


def _serialize_alert(alert: InvoiceFraudAlert) -> dict:
    return {
        'id':            str(alert.id),
        'invoice_id':    str(alert.invoice_id),
        'invoice_number': alert.invoice.invoice_number,
        'risk_score':    round(alert.risk_score, 4),
        'risk_level':    alert.risk_level,
        'auto_action':   alert.auto_action,
        'is_flagged':    alert.is_flagged,
        'flags':         alert.flags_json,
        'duplicate_invoice_ids': alert.duplicate_invoice_ids,
        'ai_explanation': alert.ai_explanation,
        'is_resolved':   alert.is_resolved,
        'resolved_at':   alert.resolved_at.isoformat() if alert.resolved_at else None,
        'resolution_note': alert.resolution_note,
        'analyzed_at':   alert.analyzed_at.isoformat() if alert.analyzed_at else None,
        'created_at':    alert.created_at.isoformat(),
    }


class FraudAnalyzeView(APIView):
    """
    POST /api/v1/invoices/<uuid>/fraud/analyze/
    Enqueue async fraud analysis for the invoice. Returns immediately.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_pk):
        invoice = get_object_or_404(
            Invoice,
            id=invoice_pk,
            company__in=request.user.companies.filter(is_active=True),
            is_active=True,
        )

        try:
            from tasks.fraud_tasks import analyze_invoice_fraud
            analyze_invoice_fraud.apply_async(
                args=[str(invoice.id)],
                queue='fraud_analysis',
                countdown=1,
            )
        except Exception as exc:
            logger.warning('Celery unavailable — running fraud sync: %s', exc)
            try:
                from tasks.fraud_tasks import analyze_invoice_fraud
                analyze_invoice_fraud.apply(args=[str(invoice.id)])
            except Exception as exc2:
                logger.error('Synchronous fraud analysis failed: %s', exc2)
                return error_response('Fraud analysis failed. Try again.',
                                      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return success_response(
            data={'invoice_id': str(invoice.id)},
            message='Fraud analysis queued.',
            status_code=status.HTTP_202_ACCEPTED,
        )


class FraudAlertDetailView(APIView):
    """GET /api/v1/invoices/<uuid>/fraud/ — retrieve the alert for one invoice."""
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_pk):
        invoice = get_object_or_404(
            Invoice,
            id=invoice_pk,
            company__in=request.user.companies.filter(is_active=True),
            is_active=True,
        )

        try:
            alert = invoice.fraud_alert
        except InvoiceFraudAlert.DoesNotExist:
            return error_response('No fraud analysis found for this invoice.',
                                  status_code=status.HTTP_404_NOT_FOUND)

        return success_response(data=_serialize_alert(alert))


class FraudResolveView(APIView):
    """
    PUT /api/v1/invoices/<uuid>/fraud/resolve/
    Mark a fraud alert as resolved (dismissed or confirmed fraud).
    Body: { "resolution_note": "..." }
    """
    permission_classes = [IsAuthenticated]

    def put(self, request, invoice_pk):
        invoice = get_object_or_404(
            Invoice,
            id=invoice_pk,
            company__in=request.user.companies.filter(is_active=True),
            is_active=True,
        )

        try:
            alert = invoice.fraud_alert
        except InvoiceFraudAlert.DoesNotExist:
            return error_response('No fraud alert found for this invoice.',
                                  status_code=status.HTTP_404_NOT_FOUND)

        if alert.is_resolved:
            return error_response('Alert is already resolved.',
                                  status_code=status.HTTP_400_BAD_REQUEST)

        note = request.data.get('resolution_note', '').strip()
        alert.is_resolved    = True
        alert.resolved_by    = request.user
        alert.resolved_at    = timezone.now()
        alert.resolution_note = note
        alert.save(update_fields=['is_resolved', 'resolved_by', 'resolved_at',
                                  'resolution_note', 'updated_at'])

        logger.info('Fraud alert resolved: invoice=%s by=%s', invoice.invoice_number,
                    request.user.email)
        return success_response(data=_serialize_alert(alert), message='Alert resolved.')


class FraudAlertListView(APIView):
    """
    GET /api/v1/fraud/alerts/
    List all fraud alerts across companies the user belongs to.
    Query params: risk_level, is_resolved, company_id
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_company_ids = list(
            request.user.companies.filter(is_active=True).values_list('id', flat=True)
        )
        qs = (
            InvoiceFraudAlert.objects
            .filter(invoice__company_id__in=user_company_ids, is_active=True)
            .select_related('invoice', 'resolved_by')
            .order_by('-created_at')
        )

        risk_level = request.query_params.get('risk_level', '').strip()
        if risk_level:
            qs = qs.filter(risk_level=risk_level)

        is_resolved = request.query_params.get('is_resolved', '').strip()
        if is_resolved in ('true', '1'):
            qs = qs.filter(is_resolved=True)
        elif is_resolved in ('false', '0'):
            qs = qs.filter(is_resolved=False)

        company_id = request.query_params.get('company_id', '').strip()
        if company_id:
            qs = qs.filter(invoice__company_id=company_id)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        data = [_serialize_alert(a) for a in page]

        return success_response(data={
            'results': data,
            'pagination': {
                'count':    paginator.page.paginator.count,
                'next':     paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
            },
        })
