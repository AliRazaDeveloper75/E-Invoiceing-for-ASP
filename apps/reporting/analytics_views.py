"""
AI Analytics API views.

GET  /api/v1/reports/analytics/          — full AI analytics report
GET  /api/v1/reports/analytics/revenue/  — revenue + forecast only
GET  /api/v1/reports/analytics/vat/      — VAT breakdown by rate type
GET  /api/v1/reports/analytics/payments/ — payment predictions + outstanding
"""
import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.utils import success_response, error_response

logger = logging.getLogger(__name__)


def _resolve_company(request):
    """Return the first active company the user belongs to, or the one in query params."""
    company_id = request.query_params.get('company_id', '').strip()
    qs = request.user.companies.filter(is_active=True)
    if company_id:
        qs = qs.filter(id=company_id)
    company = qs.first()
    return company


class AnalyticsReportView(APIView):
    """
    GET /api/v1/reports/analytics/?company_id=<uuid>&months=6
    Full AI-enhanced analytics report.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = _resolve_company(request)
        if not company:
            return error_response('No active company found.',
                                  status_code=status.HTTP_404_NOT_FOUND)

        months = int(request.query_params.get('months', 6))
        months = max(1, min(months, 24))

        try:
            from services.ai.analytics_service import AnalyticsService
            svc = AnalyticsService()
            report = svc.generate_report(str(company.id), period_months=months)
        except Exception as exc:
            logger.exception('Analytics report failed for company %s', company.id)
            return error_response('Analytics generation failed. Try again.',
                                  status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return success_response(data=report.to_dict())


class RevenueAnalyticsView(APIView):
    """GET /api/v1/reports/analytics/revenue/ — revenue trend + forecasting."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = _resolve_company(request)
        if not company:
            return error_response('No active company found.',
                                  status_code=status.HTTP_404_NOT_FOUND)

        months = int(request.query_params.get('months', 6))
        months = max(1, min(months, 24))

        try:
            from services.ai.analytics_service import AnalyticsService
            from django.utils import timezone
            svc = AnalyticsService()
            today = timezone.localdate()
            monthly = svc._get_monthly_metrics(str(company.id), today, months)
            forecast_month, forecast_quarter = svc._forecast_revenue(monthly)
            total = sum(m.revenue for m in monthly)
            growth = 0.0
            if len(monthly) >= 2:
                mid = len(monthly) // 2
                first_half  = sum(m.revenue for m in monthly[:mid]) or 0.001
                second_half = sum(m.revenue for m in monthly[mid:])
                growth = round(((second_half - first_half) / first_half) * 100, 2)
        except Exception as exc:
            logger.exception('Revenue analytics failed for company %s', company.id)
            return error_response('Revenue analytics failed.',
                                  status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return success_response(data={
            'company_id':          str(company.id),
            'period_months':       months,
            'monthly':             [vars(m) for m in monthly],
            'total_revenue_aed':   total,
            'growth_pct':          growth,
            'forecast_next_month_aed':   forecast_month,
            'forecast_next_quarter_aed': forecast_quarter,
        })


class VATAnalyticsView(APIView):
    """GET /api/v1/reports/analytics/vat/ — VAT breakdown."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = _resolve_company(request)
        if not company:
            return error_response('No active company found.',
                                  status_code=status.HTTP_404_NOT_FOUND)

        months = int(request.query_params.get('months', 3))
        months = max(1, min(months, 12))

        try:
            from services.ai.analytics_service import AnalyticsService
            from django.utils import timezone
            svc = AnalyticsService()
            today = timezone.localdate()
            monthly = svc._get_monthly_metrics(str(company.id), today, months)
            breakdown = svc._get_vat_breakdown(str(company.id), today, months)
            total_vat = sum(m.vat_collected for m in monthly)
        except Exception as exc:
            logger.exception('VAT analytics failed for company %s', company.id)
            return error_response('VAT analytics failed.',
                                  status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return success_response(data={
            'company_id':          str(company.id),
            'period_months':       months,
            'total_vat_aed':       total_vat,
            'monthly_vat':         [{'month': m.month, 'vat_aed': m.vat_collected} for m in monthly],
            'rate_breakdown':      breakdown,
        })


class PaymentAnalyticsView(APIView):
    """GET /api/v1/reports/analytics/payments/ — payment predictions."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = _resolve_company(request)
        if not company:
            return error_response('No active company found.',
                                  status_code=status.HTTP_404_NOT_FOUND)

        try:
            from services.ai.analytics_service import AnalyticsService
            from django.utils import timezone
            svc = AnalyticsService()
            today = timezone.localdate()
            total_outstanding, avg_days, predictions = svc._get_payment_data(
                str(company.id), today
            )
        except Exception as exc:
            logger.exception('Payment analytics failed for company %s', company.id)
            return error_response('Payment analytics failed.',
                                  status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return success_response(data={
            'company_id':          str(company.id),
            'total_outstanding_aed': total_outstanding,
            'avg_days_to_pay':     avg_days,
            'predictions':         [vars(p) for p in predictions],
            'high_risk_count':     sum(1 for p in predictions if p.risk_label == 'high'),
        })
