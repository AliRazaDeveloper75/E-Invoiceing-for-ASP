"""
Accounts Receivable (AR) reporting endpoints.

  GET /api/v1/reports/ar/summary/?company_id=<uuid>
  GET /api/v1/reports/ar/aging/?company_id=<uuid>[&customer_id=<uuid>]
  GET /api/v1/reports/ar/by-customer/?company_id=<uuid>
  GET /api/v1/reports/ar/customer/<uuid>/statement/?company_id=<uuid>

All endpoints are scoped to the authenticated user's company and operate on
"receivable" invoices only (real, sent invoices with an outstanding balance —
excludes draft / cancelled / deactivated).
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import F, Sum, DecimalField, ExpressionWrapper
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response, error_response
from apps.invoices.models import Invoice
from apps.invoices.permissions import get_company_and_membership

_EXCLUDED = ['draft', 'cancelled', 'deactivated']
_BALANCE = ExpressionWrapper(
    F('total_amount') - F('amount_paid'),
    output_field=DecimalField(max_digits=15, decimal_places=2),
)


def _company(request):
    company_id = request.query_params.get('company_id')
    company, membership = get_company_and_membership(request.user, company_id)
    return company


def _receivables(company):
    """Outstanding invoices for a company (balance > 0, real status)."""
    return (Invoice.objects.filter(company=company, is_active=True)
            .exclude(status__in=_EXCLUDED)
            .annotate(balance=_BALANCE)
            .filter(balance__gt=0)
            .select_related('customer'))


def _bucket(days):
    if days <= 0:
        return 'current'
    if days <= 30:
        return 'd1_30'
    if days <= 60:
        return 'd31_60'
    if days <= 90:
        return 'd61_90'
    return 'd90_plus'


class ARSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = _company(request)
        if not company:
            return error_response('Company not found or access denied.', status_code=403)

        today = timezone.now().date()
        qs = _receivables(company)
        total_receivable = Decimal('0.00')
        total_overdue = Decimal('0.00')
        open_count = 0
        overdue_count = 0
        for inv in qs:
            total_receivable += inv.balance
            open_count += 1
            if inv.due_date and inv.due_date < today:
                total_overdue += inv.balance
                overdue_count += 1

        # DSO ≈ receivable / credit sales (last 90 days) * 90
        since = today - timedelta(days=90)
        credit_sales = (Invoice.objects.filter(company=company, is_active=True,
                                               issue_date__gte=since)
                        .exclude(status__in=_EXCLUDED)
                        .aggregate(s=Sum('total_amount'))['s'] or Decimal('0.00'))
        dso = int((total_receivable / credit_sales) * 90) if credit_sales > 0 else 0

        return success_response(data={
            'currency': 'AED',
            'total_receivable': str(total_receivable),
            'total_overdue': str(total_overdue),
            'open_invoice_count': open_count,
            'overdue_invoice_count': overdue_count,
            'dso_days': dso,
        })


class ARAgingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = _company(request)
        if not company:
            return error_response('Company not found or access denied.', status_code=403)

        today = timezone.now().date()
        qs = _receivables(company)
        customer_id = request.query_params.get('customer_id')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        buckets = {'current': Decimal('0.00'), 'd1_30': Decimal('0.00'),
                   'd31_60': Decimal('0.00'), 'd61_90': Decimal('0.00'),
                   'd90_plus': Decimal('0.00')}
        total = Decimal('0.00')
        for inv in qs:
            days = (today - inv.due_date).days if inv.due_date else 0
            buckets[_bucket(days)] += inv.balance
            total += inv.balance

        return success_response(data={
            'currency': 'AED',
            'buckets': {k: str(v) for k, v in buckets.items()},
            'labels': {'current': 'Current', 'd1_30': '1–30', 'd31_60': '31–60',
                       'd61_90': '61–90', 'd90_plus': '90+'},
            'total': str(total),
        })


class ARByCustomerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = _company(request)
        if not company:
            return error_response('Company not found or access denied.', status_code=403)

        today = timezone.now().date()
        rows = {}
        for inv in _receivables(company):
            cid = str(inv.customer_id)
            r = rows.setdefault(cid, {
                'customer_id': cid,
                'customer_name': inv.customer.name if inv.customer else '—',
                'outstanding': Decimal('0.00'),
                'overdue': Decimal('0.00'),
                'invoice_count': 0,
            })
            r['outstanding'] += inv.balance
            r['invoice_count'] += 1
            if inv.due_date and inv.due_date < today:
                r['overdue'] += inv.balance

        result = sorted(rows.values(), key=lambda x: x['outstanding'], reverse=True)
        for r in result:
            r['outstanding'] = str(r['outstanding'])
            r['overdue'] = str(r['overdue'])
        return success_response(data={'currency': 'AED', 'customers': result})


class ARCustomerStatementView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        company = _company(request)
        if not company:
            return error_response('Company not found or access denied.', status_code=403)

        invoices = (Invoice.objects.filter(company=company, customer_id=customer_id,
                                           is_active=True)
                    .exclude(status__in=_EXCLUDED)
                    .select_related('customer')
                    .order_by('issue_date', 'invoice_sequence'))

        lines = []
        running = Decimal('0.00')
        customer_name = '—'
        for inv in invoices:
            if inv.customer:
                customer_name = inv.customer.name
            balance = (inv.total_amount or Decimal('0.00')) - (inv.amount_paid or Decimal('0.00'))
            running += balance
            lines.append({
                'invoice_id': str(inv.id),
                'invoice_number': inv.invoice_number,
                'issue_date': inv.issue_date,
                'due_date': inv.due_date,
                'status': inv.status,
                'total_amount': str(inv.total_amount),
                'amount_paid': str(inv.amount_paid),
                'balance_due': str(balance),
                'running_balance': str(running),
                'is_overdue': inv.is_overdue,
                'days_overdue': inv.days_overdue,
            })

        return success_response(data={
            'currency': 'AED',
            'customer_id': str(customer_id),
            'customer_name': customer_name,
            'total_outstanding': str(running),
            'lines': lines,
        })
