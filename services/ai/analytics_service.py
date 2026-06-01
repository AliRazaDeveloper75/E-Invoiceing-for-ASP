"""
AI Analytics Service.

Generates predictive revenue analytics, VAT trend analysis, payment
predictions, and business forecasting using historical invoice data
combined with LLM interpretation.

Entry point: AnalyticsService.generate_report(company_id, period_months)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Result types ─────────────────────────────────────────────────────────────

@dataclass
class MonthlyMetric:
    month: str          # 'YYYY-MM'
    revenue: float
    vat_collected: float
    invoice_count: int
    avg_invoice_value: float


@dataclass
class PaymentPrediction:
    customer_id: str
    customer_name: str
    outstanding_amount: float
    days_overdue: int
    predicted_pay_probability: float   # 0.0–1.0
    predicted_days_to_pay: Optional[int]
    risk_label: str                    # 'low' | 'medium' | 'high'


@dataclass
class AnalyticsReport:
    company_id: str
    generated_at: str
    period_months: int

    # Revenue
    monthly_revenue: list[MonthlyMetric] = field(default_factory=list)
    total_revenue: float = 0.0
    revenue_growth_pct: float = 0.0     # vs previous period

    # VAT
    total_vat_collected: float = 0.0
    vat_rate_breakdown: dict = field(default_factory=dict)   # 'standard'/'zero'/'exempt' → amount

    # Forecasting
    next_month_revenue_forecast: float = 0.0
    next_quarter_revenue_forecast: float = 0.0

    # Customers
    top_customers: list[dict] = field(default_factory=list)

    # Payments
    payment_predictions: list[PaymentPrediction] = field(default_factory=list)
    total_outstanding: float = 0.0
    avg_days_to_pay: Optional[float] = None

    # AI insights
    ai_insights: Optional[str] = None
    recommendations: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            'company_id':     self.company_id,
            'generated_at':   self.generated_at,
            'period_months':  self.period_months,
            'revenue': {
                'monthly':          [vars(m) for m in self.monthly_revenue],
                'total_aed':        self.total_revenue,
                'growth_pct':       self.revenue_growth_pct,
                'forecast_next_month_aed':    self.next_month_revenue_forecast,
                'forecast_next_quarter_aed':  self.next_quarter_revenue_forecast,
            },
            'vat': {
                'total_collected_aed': self.total_vat_collected,
                'rate_breakdown':      self.vat_rate_breakdown,
            },
            'customers': {
                'top_by_revenue': self.top_customers,
            },
            'payments': {
                'total_outstanding_aed': self.total_outstanding,
                'avg_days_to_pay':       self.avg_days_to_pay,
                'predictions':           [vars(p) for p in self.payment_predictions],
            },
            'ai_insights':      self.ai_insights,
            'recommendations':  self.recommendations,
        }


# ─── Service ──────────────────────────────────────────────────────────────────

class AnalyticsService:
    """
    Generates AI-enhanced analytics reports for a company.

    Usage:
        svc = AnalyticsService()
        report = svc.generate_report(company_id='...', period_months=6)
    """

    def generate_report(self, company_id: str, period_months: int = 6) -> AnalyticsReport:
        from django.utils import timezone

        today = timezone.localdate()
        report = AnalyticsReport(
            company_id=company_id,
            generated_at=timezone.now().isoformat(),
            period_months=period_months,
        )

        # 1. Revenue + VAT metrics
        monthly = self._get_monthly_metrics(company_id, today, period_months)
        report.monthly_revenue = monthly
        report.total_revenue        = sum(m.revenue for m in monthly)
        report.total_vat_collected  = sum(m.vat_collected for m in monthly)

        # 2. Growth rate (compare first vs last half of the period)
        if len(monthly) >= 2:
            mid = len(monthly) // 2
            first_half  = sum(m.revenue for m in monthly[:mid]) or 0.001
            second_half = sum(m.revenue for m in monthly[mid:])
            report.revenue_growth_pct = round(
                ((second_half - first_half) / first_half) * 100, 2
            )

        # 3. Revenue forecasting (simple linear projection)
        report.next_month_revenue_forecast, report.next_quarter_revenue_forecast = (
            self._forecast_revenue(monthly)
        )

        # 4. VAT breakdown by rate type
        report.vat_rate_breakdown = self._get_vat_breakdown(company_id, today, period_months)

        # 5. Top customers
        report.top_customers = self._get_top_customers(company_id, today, period_months)

        # 6. Outstanding invoices + payment predictions
        report.total_outstanding, report.avg_days_to_pay, report.payment_predictions = (
            self._get_payment_data(company_id, today)
        )

        # 7. AI insights (non-blocking — skip on failure)
        try:
            report.ai_insights, report.recommendations = self._get_ai_insights(report)
        except Exception as exc:
            logger.warning('AI insights generation failed: %s', exc)

        return report

    # ── Private helpers ───────────────────────────────────────────────────────

    def _get_monthly_metrics(self, company_id: str, today: date,
                              months: int) -> list[MonthlyMetric]:
        from django.db.models import Sum, Count
        from apps.invoices.models import Invoice

        result = []
        for i in range(months - 1, -1, -1):
            month_start = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
            if i > 0:
                next_month = (month_start + timedelta(days=32)).replace(day=1)
            else:
                next_month = (today.replace(day=1) + timedelta(days=32)).replace(day=1)

            agg = Invoice.objects.filter(
                company_id=company_id,
                is_active=True,
                issue_date__gte=month_start,
                issue_date__lt=next_month,
            ).aggregate(
                revenue=Sum('total_amount'),
                vat=Sum('total_vat'),
                count=Count('id'),
            )

            count   = agg['count'] or 0
            revenue = float(agg['revenue'] or 0)
            result.append(MonthlyMetric(
                month=month_start.strftime('%Y-%m'),
                revenue=revenue,
                vat_collected=float(agg['vat'] or 0),
                invoice_count=count,
                avg_invoice_value=round(revenue / count, 2) if count else 0.0,
            ))
        return result

    def _forecast_revenue(self, monthly: list[MonthlyMetric]) -> tuple[float, float]:
        if not monthly:
            return 0.0, 0.0

        revenues = [m.revenue for m in monthly]
        n = len(revenues)

        if n < 2:
            forecast_month   = revenues[-1]
            forecast_quarter = revenues[-1] * 3
            return round(forecast_month, 2), round(forecast_quarter, 2)

        # Simple linear regression over month indices
        x_mean = (n - 1) / 2
        y_mean = sum(revenues) / n
        numerator   = sum((i - x_mean) * (revenues[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator else 0

        forecast_month   = max(0.0, y_mean + slope * (n - x_mean))
        forecast_quarter = max(0.0, sum(
            y_mean + slope * (n + j - x_mean) for j in range(3)
        ))
        return round(forecast_month, 2), round(forecast_quarter, 2)

    def _get_vat_breakdown(self, company_id: str, today: date,
                            months: int) -> dict:
        from django.db.models import Sum
        from apps.invoices.models import InvoiceItem

        cutoff = today.replace(day=1) - timedelta(days=(months - 1) * 30)
        cutoff = cutoff.replace(day=1)

        rows = (
            InvoiceItem.objects
            .filter(
                invoice__company_id=company_id,
                invoice__is_active=True,
                invoice__issue_date__gte=cutoff,
            )
            .values('vat_rate_type')
            .annotate(total_vat=Sum('vat_amount'), total_subtotal=Sum('subtotal'))
        )
        return {
            row['vat_rate_type']: {
                'vat_amount_aed':      float(row['total_vat'] or 0),
                'subtotal_aed':        float(row['total_subtotal'] or 0),
            }
            for row in rows
        }

    def _get_top_customers(self, company_id: str, today: date,
                            months: int) -> list[dict]:
        from django.db.models import Sum, Count
        from apps.invoices.models import Invoice

        cutoff = today - timedelta(days=months * 30)
        rows = (
            Invoice.objects
            .filter(company_id=company_id, is_active=True, issue_date__gte=cutoff)
            .values('customer_id', 'customer__name')
            .annotate(total=Sum('total_amount'), invoices=Count('id'))
            .order_by('-total')[:10]
        )
        return [
            {
                'customer_id':    str(row['customer_id']),
                'customer_name':  row['customer__name'],
                'total_revenue_aed': float(row['total'] or 0),
                'invoice_count':  row['invoices'],
            }
            for row in rows
        ]

    def _get_payment_data(self, company_id: str,
                           today: date) -> tuple[float, float | None, list[PaymentPrediction]]:
        from django.db.models import Sum, Avg, F
        from apps.invoices.models import Invoice

        # Outstanding invoices
        outstanding_qs = Invoice.objects.filter(
            company_id=company_id,
            is_active=True,
            status__in=['submitted', 'validated', 'pending'],
        ).select_related('customer')

        total_outstanding = float(
            outstanding_qs.aggregate(t=Sum('total_amount'))['t'] or 0
        )

        # Average days-to-pay (paid invoices only)
        paid_qs = Invoice.objects.filter(
            company_id=company_id,
            is_active=True,
            status='validated',
            asp_submitted_at__isnull=False,
        )
        avg_days = None
        if paid_qs.exists():
            # Approximate via submit → now delta for paid invoices
            from django.db.models.functions import ExtractDay
            deltas = [
                (today - inv.issue_date).days
                for inv in paid_qs[:200]
                if inv.issue_date
            ]
            if deltas:
                avg_days = round(sum(deltas) / len(deltas), 1)

        # Payment predictions per customer
        predictions: list[PaymentPrediction] = []
        seen_customers: set = set()

        for inv in outstanding_qs.order_by('due_date')[:50]:
            cid = str(inv.customer_id)
            if cid in seen_customers:
                continue
            seen_customers.add(cid)

            days_overdue = (today - inv.due_date).days if inv.due_date and inv.due_date < today else 0

            # Simple heuristic: probability decreases with days overdue
            if days_overdue <= 0:
                prob = 0.90
                risk = 'low'
                pred_days = 7
            elif days_overdue <= 14:
                prob = 0.70
                risk = 'medium'
                pred_days = 14
            elif days_overdue <= 30:
                prob = 0.45
                risk = 'medium'
                pred_days = 21
            else:
                prob = 0.20
                risk = 'high'
                pred_days = None

            cust_outstanding = float(
                outstanding_qs.filter(customer_id=inv.customer_id)
                .aggregate(t=Sum('total_amount'))['t'] or 0
            )
            predictions.append(PaymentPrediction(
                customer_id=cid,
                customer_name=inv.customer.name,
                outstanding_amount=cust_outstanding,
                days_overdue=days_overdue,
                predicted_pay_probability=prob,
                predicted_days_to_pay=pred_days,
                risk_label=risk,
            ))

        return total_outstanding, avg_days, predictions

    def _get_ai_insights(self, report: AnalyticsReport) -> tuple[str, list[str]]:
        from services.ai.registry import get_ai_provider

        summary = {
            'total_revenue_aed':     report.total_revenue,
            'revenue_growth_pct':    report.revenue_growth_pct,
            'total_vat_aed':         report.total_vat_collected,
            'total_outstanding_aed': report.total_outstanding,
            'next_month_forecast':   report.next_month_revenue_forecast,
            'avg_days_to_pay':       report.avg_days_to_pay,
            'high_risk_customers':   sum(
                1 for p in report.payment_predictions if p.risk_label == 'high'
            ),
            'period_months':         report.period_months,
        }

        prompt = (
            f'You are a UAE business analytics advisor. Analyze this invoice/revenue data:\n'
            f'{summary}\n\n'
            f'Provide:\n'
            f'1. A 3-sentence business insight paragraph\n'
            f'2. 3 specific actionable recommendations as a JSON array of strings\n\n'
            f'Format response as JSON: {{"insights": "...", "recommendations": ["...", "...", "..."]}}'
        )

        provider = get_ai_provider()
        response = provider.chat(
            messages=[{'role': 'user', 'content': prompt}],
            system='You are a concise UAE business analytics advisor.',
            max_tokens=600,
            temperature=0.4,
        )

        import json, re
        text = response.content
        # Strip markdown fences
        text = re.sub(r'^```(?:json)?\s*', '', text.strip())
        text = re.sub(r'\s*```$', '', text.strip())

        parsed = json.loads(text)
        return parsed.get('insights', ''), parsed.get('recommendations', [])
