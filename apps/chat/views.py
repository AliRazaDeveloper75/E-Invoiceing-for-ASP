"""
AI Accounting Assistant API.

POST /api/v1/chat/         — conversational AI with NLP intent detection
POST /api/v1/chat/query/   — structured NLP-to-DB query (invoice search,
                             VAT totals, payment status)
GET  /api/v1/chat/history/ — conversation history (session-scoped)
"""
import json
import logging
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.utils import success_response, error_response

logger = logging.getLogger(__name__)

# ─── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert AI accounting assistant for a UAE e-invoicing SaaS platform.

You can help users:
1. Query invoices: "show unpaid invoices", "invoices from last month", "find invoice INV-2026-001"
2. VAT summaries: "how much VAT did I collect this quarter?", "VAT breakdown this month"
3. Payment status: "which customers owe me money?", "overdue invoices"
4. Analytics: "my top customers by revenue", "monthly revenue trend"
5. UAE compliance: VAT rules (5% standard, zero-rated, exempt), PEPPOL/PINT requirements
6. Platform help: creating invoices, credit notes, company setup

When users ask data queries, you will receive pre-fetched database results in a <data> block.
Present this data clearly in a formatted, human-readable way.

Rules:
- Stay focused on UAE e-invoicing, accounting, and this platform
- All amounts are in AED unless specified
- UAE VAT standard rate is 5%
- Keep responses concise and actionable
- For compliance questions, cite the relevant UAE Federal Decree-Law No. 16 of 2024 article when relevant"""


# ─── Intent detection ─────────────────────────────────────────────────────────

INTENT_PATTERNS = {
    'unpaid_invoices':  ['unpaid', 'outstanding', 'not paid', 'pending payment', 'owe me'],
    'overdue_invoices': ['overdue', 'past due', 'late', 'missed payment'],
    'vat_summary':      ['vat', 'tax', 'collected', 'vat total', 'vat amount', 'tax summary'],
    'recent_invoices':  ['recent', 'latest', 'last', 'this month', 'this week', 'today'],
    'invoice_search':   ['invoice', 'inv-', 'find invoice', 'show invoice', 'invoice number'],
    'revenue_summary':  ['revenue', 'income', 'total sales', 'earnings', 'how much made'],
    'top_customers':    ['top customer', 'best customer', 'biggest client', 'most revenue'],
    'draft_invoices':   ['draft', 'not sent', 'pending submission'],
}


def _detect_intent(text: str) -> str | None:
    lower = text.lower()
    for intent, keywords in INTENT_PATTERNS.items():
        if any(kw in lower for kw in keywords):
            return intent
    return None


# ─── Data fetchers ────────────────────────────────────────────────────────────

def _fetch_context_data(intent: str, user, query_text: str) -> dict | None:
    """Run a DB query matching the detected intent and return structured data."""
    from apps.invoices.models import Invoice

    company_ids = list(
        user.companies.filter(is_active=True).values_list('id', flat=True)
    )
    if not company_ids:
        return None

    base_qs = Invoice.objects.filter(
        company_id__in=company_ids,
        is_active=True,
    ).select_related('customer', 'company')

    now = timezone.now()
    today = now.date()

    if intent == 'unpaid_invoices':
        qs = base_qs.filter(status__in=['submitted', 'validated', 'pending'])
        invoices = list(qs.order_by('-issue_date')[:20])
        total_outstanding = qs.aggregate(t=Sum('total_amount'))['t'] or Decimal('0.00')
        return {
            'type':    'unpaid_invoices',
            'count':   qs.count(),
            'total_aed': float(total_outstanding),
            'invoices': [_invoice_summary(i) for i in invoices],
        }

    elif intent == 'overdue_invoices':
        qs = base_qs.filter(
            status__in=['submitted', 'validated', 'pending'],
            due_date__lt=today,
        )
        invoices = list(qs.order_by('due_date')[:20])
        total_overdue = qs.aggregate(t=Sum('total_amount'))['t'] or Decimal('0.00')
        return {
            'type':    'overdue_invoices',
            'count':   qs.count(),
            'total_aed': float(total_overdue),
            'invoices': [_invoice_summary(i) for i in invoices],
        }

    elif intent == 'vat_summary':
        month_start = today.replace(day=1)
        qs = base_qs.filter(issue_date__gte=month_start)
        agg = qs.aggregate(vat=Sum('total_vat'), total=Sum('total_amount'), sub=Sum('subtotal'))
        return {
            'type':         'vat_summary',
            'period':       f'{month_start} to {today}',
            'total_vat_aed':   float(agg['vat'] or 0),
            'total_revenue_aed': float(agg['total'] or 0),
            'subtotal_aed': float(agg['sub'] or 0),
            'invoice_count': qs.count(),
        }

    elif intent == 'recent_invoices':
        days = 7
        if 'month' in query_text.lower():
            days = 30
        elif 'today' in query_text.lower():
            days = 0
        cutoff = today - timedelta(days=days)
        qs = base_qs.filter(issue_date__gte=cutoff)
        invoices = list(qs.order_by('-issue_date')[:15])
        return {
            'type':     'recent_invoices',
            'period_days': days,
            'count':    qs.count(),
            'invoices': [_invoice_summary(i) for i in invoices],
        }

    elif intent == 'revenue_summary':
        month_start = today.replace(day=1)
        this_month = base_qs.filter(issue_date__gte=month_start).aggregate(
            total=Sum('total_amount'), count=Sum('subtotal')
        )
        last_month_start = (month_start - timedelta(days=1)).replace(day=1)
        last_month = base_qs.filter(
            issue_date__gte=last_month_start, issue_date__lt=month_start
        ).aggregate(total=Sum('total_amount'))
        return {
            'type':             'revenue_summary',
            'this_month_aed':   float(this_month['total'] or 0),
            'last_month_aed':   float(last_month['total'] or 0),
            'this_month_invoices': base_qs.filter(issue_date__gte=month_start).count(),
        }

    elif intent == 'top_customers':
        from django.db.models import Count
        top = (
            base_qs.filter(issue_date__gte=today - timedelta(days=90))
            .values('customer__name', 'customer_id')
            .annotate(total=Sum('total_amount'), count=Count('id'))
            .order_by('-total')[:10]
        )
        return {
            'type':     'top_customers',
            'period':   'last 90 days',
            'customers': [
                {
                    'name':        row['customer__name'],
                    'total_aed':   float(row['total'] or 0),
                    'invoice_count': row['count'],
                }
                for row in top
            ],
        }

    elif intent == 'draft_invoices':
        qs = base_qs.filter(status='draft')
        invoices = list(qs.order_by('-created_at')[:20])
        return {
            'type':     'draft_invoices',
            'count':    qs.count(),
            'invoices': [_invoice_summary(i) for i in invoices],
        }

    return None


def _invoice_summary(invoice) -> dict:
    return {
        'id':             str(invoice.id),
        'invoice_number': invoice.invoice_number,
        'customer':       invoice.customer.name,
        'issue_date':     str(invoice.issue_date),
        'due_date':       str(invoice.due_date) if invoice.due_date else None,
        'status':         invoice.status,
        'total_amount':   float(invoice.total_amount),
        'total_vat':      float(invoice.total_vat),
        'currency':       invoice.currency,
    }


# ─── Views ────────────────────────────────────────────────────────────────────

class ChatView(APIView):
    """
    POST /api/v1/chat/
    Conversational AI accounting assistant.

    Accepts a messages array (history), detects intent, pre-fetches DB data
    when relevant, and returns an AI-generated reply with optional structured data.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        messages = request.data.get('messages', [])
        if not messages or not isinstance(messages, list):
            return error_response(
                'messages must be a non-empty list of {role, content} objects.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        for msg in messages:
            if not isinstance(msg, dict) or msg.get('role') not in ('user', 'assistant'):
                return error_response(
                    'Each message must have role ("user" or "assistant") and content.',
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            if not msg.get('content'):
                return error_response('Message content cannot be empty.',
                                      status_code=status.HTTP_400_BAD_REQUEST)

        # Detect intent from the last user message
        last_user_msg = next(
            (m['content'] for m in reversed(messages) if m['role'] == 'user'),
            '',
        )
        intent = _detect_intent(last_user_msg)
        context_data = None

        if intent:
            try:
                context_data = _fetch_context_data(intent, request.user, last_user_msg)
            except Exception as exc:
                logger.warning('Intent data fetch failed for %s: %s', intent, exc)

        # Build AI messages
        ai_messages = []

        if context_data:
            data_block = json.dumps(context_data, indent=2, default=str)
            ai_messages.append({
                'role':    'user',
                'content': (
                    f'[SYSTEM DATA for your response — do not show raw JSON to user]\n'
                    f'<data>\n{data_block}\n</data>\n\n'
                    f'User question: {last_user_msg}'
                ),
            })
            # Inject all prior messages except the last user message
            prior = [m for m in messages[:-1]]
            ai_messages = [{'role': m['role'], 'content': m['content']} for m in prior] + ai_messages
        else:
            ai_messages = [{'role': m['role'], 'content': m['content']} for m in messages]

        # Call AI provider
        try:
            from services.ai.registry import get_ai_provider
            provider = get_ai_provider()
            response = provider.chat(
                messages=ai_messages,
                system=SYSTEM_PROMPT,
                max_tokens=1500,
                temperature=0.3,
            )
            reply = response.content
        except Exception:
            logger.exception('AI provider call failed in ChatView')
            return error_response(
                'AI service is temporarily unavailable. Please try again.',
                status_code=status.HTTP_502_BAD_GATEWAY,
            )

        return success_response(data={
            'reply':        reply,
            'intent':       intent,
            'context_data': context_data,
        })


class ChatQueryView(APIView):
    """
    POST /api/v1/chat/query/
    Direct NLP-to-DB query without conversational history.
    Body: { "query": "show unpaid invoices from last month" }
    Returns structured data AND an AI summary.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = request.data.get('query', '').strip()
        if not query:
            return error_response('query is required.', status_code=status.HTTP_400_BAD_REQUEST)

        intent = _detect_intent(query)
        context_data = None

        if intent:
            try:
                context_data = _fetch_context_data(intent, request.user, query)
            except Exception as exc:
                logger.warning('Query data fetch error: %s', exc)

        # Generate natural language summary
        if context_data:
            data_block = json.dumps(context_data, indent=2, default=str)
            prompt_msg = (
                f'<data>\n{data_block}\n</data>\n\n'
                f'Summarize this data in 2-4 sentences for: "{query}"'
            )
        else:
            prompt_msg = query

        try:
            from services.ai.registry import get_ai_provider
            provider = get_ai_provider()
            response = provider.chat(
                messages=[{'role': 'user', 'content': prompt_msg}],
                system=SYSTEM_PROMPT,
                max_tokens=600,
                temperature=0.2,
            )
            summary = response.content
        except Exception:
            logger.exception('AI summary failed in ChatQueryView')
            summary = None

        return success_response(data={
            'query':        query,
            'intent':       intent,
            'summary':      summary,
            'data':         context_data,
        })
