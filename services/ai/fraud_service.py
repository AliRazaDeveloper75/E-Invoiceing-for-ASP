"""
AI Fraud Detection Service.

Analyzes invoices for anomalies, duplicates, and fraud patterns.
Uses a multi-layer scoring approach:
  Layer 1: Rule-based checks (fast, deterministic)
  Layer 2: Statistical anomaly detection (z-score, IQR)
  Layer 3: Pattern analysis (repeated amounts, timing clusters)
  Layer 4: AI analysis (LLM for complex pattern explanation)

Score: 0.0 (clean) → 1.0 (high risk)
Threshold: < 0.30 = auto-approve, 0.30–0.69 = review, >= 0.70 = flag/block
"""
from __future__ import annotations

import hashlib
import logging
import statistics
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Risk levels ──────────────────────────────────────────────────────────────

RISK_LOW    = 'low'
RISK_MEDIUM = 'medium'
RISK_HIGH   = 'high'

RISK_THRESHOLDS = {
    RISK_LOW:    (0.00, 0.30),
    RISK_MEDIUM: (0.30, 0.70),
    RISK_HIGH:   (0.70, 1.00),
}


# ─── Result types ─────────────────────────────────────────────────────────────

@dataclass
class FraudFlag:
    code: str
    description: str
    severity: float        # 0.0–1.0 contribution to total score
    category: str          # 'duplicate' | 'amount' | 'vat' | 'supplier' | 'pattern' | 'timing'


@dataclass
class FraudAnalysisResult:
    invoice_id: str
    risk_score: float                      # 0.0–1.0
    risk_level: str                        # 'low' | 'medium' | 'high'
    flags: list[FraudFlag] = field(default_factory=list)
    duplicate_invoice_ids: list[str] = field(default_factory=list)
    ai_explanation: Optional[str] = None
    auto_action: str = 'none'             # 'none' | 'flag' | 'block' | 'approve'

    @property
    def is_flagged(self) -> bool:
        return self.risk_level in (RISK_MEDIUM, RISK_HIGH)

    def to_dict(self) -> dict:
        return {
            'invoice_id':             self.invoice_id,
            'risk_score':             round(self.risk_score, 4),
            'risk_level':             self.risk_level,
            'auto_action':            self.auto_action,
            'is_flagged':             self.is_flagged,
            'duplicate_invoice_ids':  self.duplicate_invoice_ids,
            'ai_explanation':         self.ai_explanation,
            'flags': [
                {
                    'code':        f.code,
                    'description': f.description,
                    'severity':    round(f.severity, 4),
                    'category':    f.category,
                }
                for f in self.flags
            ],
        }


# ─── Service ──────────────────────────────────────────────────────────────────

class FraudService:
    """
    Multi-layer invoice fraud detection engine.

    Usage:
      result = FraudService().analyze(invoice)
    """

    # Maximum risk contribution per check (prevents one check from dominating)
    DUPLICATE_WEIGHT    = 0.70
    VAT_ANOMALY_WEIGHT  = 0.40
    AMOUNT_ANOMALY_WEIGHT = 0.35
    PATTERN_WEIGHT      = 0.30
    SUPPLIER_WEIGHT     = 0.25
    TIMING_WEIGHT       = 0.20

    def analyze(self, invoice) -> FraudAnalysisResult:
        """
        Run all fraud checks on an invoice.

        Args:
            invoice: Invoice model instance (must be saved in DB).

        Returns:
            FraudAnalysisResult with risk score and flags.
        """
        flags: list[FraudFlag] = []

        # Layer 1: Duplicate detection
        dupe_flags, dupe_ids = self._check_duplicates(invoice)
        flags.extend(dupe_flags)

        # Layer 2: VAT anomaly
        flags.extend(self._check_vat_anomaly(invoice))

        # Layer 3: Statistical amount anomaly
        flags.extend(self._check_amount_anomaly(invoice))

        # Layer 4: Pattern analysis
        flags.extend(self._check_patterns(invoice))

        # Layer 5: Supplier/customer checks
        flags.extend(self._check_supplier(invoice))

        # Layer 6: Timing analysis
        flags.extend(self._check_timing(invoice))

        # Aggregate score (capped at 1.0)
        raw_score  = sum(f.severity for f in flags)
        risk_score = min(1.0, raw_score)

        # Determine level
        risk_level = self._score_to_level(risk_score)

        # Auto-action
        auto_action = self._determine_action(risk_score, flags)

        result = FraudAnalysisResult(
            invoice_id=str(invoice.id),
            risk_score=risk_score,
            risk_level=risk_level,
            flags=flags,
            duplicate_invoice_ids=dupe_ids,
            auto_action=auto_action,
        )

        # Layer 7: AI explanation for high-risk invoices
        if risk_level == RISK_HIGH and flags:
            result.ai_explanation = self._get_ai_explanation(invoice, result)

        logger.info(
            'Fraud analysis: invoice=%s score=%.3f level=%s flags=%d action=%s',
            getattr(invoice, 'invoice_number', invoice.id),
            risk_score, risk_level, len(flags), auto_action,
        )

        return result

    # ── Layer 1: Duplicate Detection ──────────────────────────────────────────

    def _check_duplicates(self, invoice) -> tuple[list[FraudFlag], list[str]]:
        """
        Detect duplicate invoices using multiple hash strategies:
          1. Exact invoice_number match (same company)
          2. Amount + customer + date fingerprint
          3. Near-duplicate: same amount ± 1% within 7 days
        """
        from apps.invoices.models import Invoice

        flags:    list[FraudFlag] = []
        dupe_ids: list[str]       = []

        base_qs = Invoice.objects.filter(
            company=invoice.company,
            is_active=True,
        ).exclude(id=invoice.id)

        # 1. Exact invoice number duplicate (different invoice, same number)
        same_number = base_qs.filter(invoice_number=invoice.invoice_number)
        if invoice.invoice_number and same_number.exists():
            ids = list(same_number.values_list('id', flat=True))
            dupe_ids.extend([str(i) for i in ids])
            flags.append(FraudFlag(
                code='DUPLICATE_NUMBER',
                description=f'Invoice number "{invoice.invoice_number}" already exists.',
                severity=self.DUPLICATE_WEIGHT,
                category='duplicate',
            ))

        # 2. Financial fingerprint: same customer + same total + same date
        if invoice.customer_id and invoice.total_amount and invoice.issue_date:
            financial_dupes = base_qs.filter(
                customer=invoice.customer,
                total_amount=invoice.total_amount,
                issue_date=invoice.issue_date,
            )
            if financial_dupes.exists():
                ids = list(financial_dupes.values_list('id', flat=True))
                dupe_ids.extend([str(i) for i in ids if str(i) not in dupe_ids])
                flags.append(FraudFlag(
                    code='DUPLICATE_FINGERPRINT',
                    description=(
                        f'Same customer, amount ({invoice.total_amount}), '
                        f'and date ({invoice.issue_date}) as an existing invoice.'
                    ),
                    severity=self.DUPLICATE_WEIGHT * 0.85,
                    category='duplicate',
                ))

        # 3. Near-duplicate: ±1% amount, same customer, within 7 days
        if not flags and invoice.total_amount and invoice.issue_date and invoice.customer_id:
            from django.utils import timezone
            from datetime import timedelta
            from django.db.models import Q

            amt  = Decimal(str(invoice.total_amount))
            tol  = amt * Decimal('0.01')
            date = invoice.issue_date

            near = base_qs.filter(
                customer=invoice.customer,
                issue_date__range=(date - timedelta(days=7), date + timedelta(days=7)),
                total_amount__range=(amt - tol, amt + tol),
            )
            if near.exists():
                ids = list(near.values_list('id', flat=True))
                dupe_ids.extend([str(i) for i in ids if str(i) not in dupe_ids])
                flags.append(FraudFlag(
                    code='NEAR_DUPLICATE',
                    description='Similar invoice (±1% amount) issued to same customer within 7 days.',
                    severity=self.DUPLICATE_WEIGHT * 0.50,
                    category='duplicate',
                ))

        return flags, dupe_ids

    # ── Layer 2: VAT Anomaly ──────────────────────────────────────────────────

    def _check_vat_anomaly(self, invoice) -> list[FraudFlag]:
        """Validate VAT arithmetic and expected rate for transaction type."""
        flags: list[FraudFlag] = []

        total_amount = Decimal(str(invoice.total_amount or 0))
        total_vat    = Decimal(str(invoice.total_vat    or 0))
        subtotal     = Decimal(str(invoice.subtotal     or 0))

        if total_amount <= 0:
            return flags

        # Check VAT arithmetic
        if subtotal > 0 and total_vat > 0:
            expected_total = subtotal + total_vat
            if abs(expected_total - total_amount) > Decimal('1.00'):
                flags.append(FraudFlag(
                    code='VAT_ARITHMETIC_ERROR',
                    description=(
                        f'VAT arithmetic mismatch: subtotal {subtotal} + VAT {total_vat} '
                        f'= {expected_total}, but total is {total_amount}.'
                    ),
                    severity=self.VAT_ANOMALY_WEIGHT * 0.8,
                    category='vat',
                ))

        # Check VAT rate consistency
        if subtotal > 0 and total_vat > 0:
            actual_rate = (total_vat / subtotal * 100).quantize(Decimal('0.01'))
            # UAE standard rate is 5%; check if claimed rate is wildly off
            if actual_rate > Decimal('6.00'):
                flags.append(FraudFlag(
                    code='VAT_RATE_TOO_HIGH',
                    description=f'Implied VAT rate is {actual_rate}% — UAE standard is 5%.',
                    severity=self.VAT_ANOMALY_WEIGHT * 0.6,
                    category='vat',
                ))
            elif Decimal('0.01') < actual_rate < Decimal('4.50'):
                flags.append(FraudFlag(
                    code='VAT_RATE_SUSPICIOUSLY_LOW',
                    description=f'Implied VAT rate is {actual_rate}% — unexpectedly low.',
                    severity=self.VAT_ANOMALY_WEIGHT * 0.3,
                    category='vat',
                ))

        # Round-number VAT amounts are suspicious
        if total_vat > 0 and total_vat % 1 == 0 and total_vat > Decimal('100'):
            flags.append(FraudFlag(
                code='ROUND_VAT_AMOUNT',
                description=f'VAT amount is a round number ({total_vat}), which is unusual.',
                severity=0.10,
                category='vat',
            ))

        return flags

    # ── Layer 3: Amount Anomaly ───────────────────────────────────────────────

    def _check_amount_anomaly(self, invoice) -> list[FraudFlag]:
        """Z-score analysis: is this invoice significantly larger than average?"""
        flags: list[FraudFlag] = []

        if not invoice.total_amount or invoice.total_amount <= 0:
            return flags

        from apps.invoices.models import Invoice

        recent = list(
            Invoice.objects.filter(
                company=invoice.company,
                is_active=True,
                total_amount__gt=0,
            ).exclude(id=invoice.id)
            .order_by('-created_at')[:200]
            .values_list('total_amount', flat=True)
        )

        if len(recent) < 10:
            return flags

        amounts = [float(a) for a in recent]
        mean    = statistics.mean(amounts)
        stdev   = statistics.stdev(amounts) if len(amounts) > 1 else 0

        if stdev == 0:
            return flags

        current = float(invoice.total_amount)
        z_score = (current - mean) / stdev

        if z_score > 4.0:
            flags.append(FraudFlag(
                code='EXTREME_AMOUNT',
                description=(
                    f'Invoice amount {current:,.2f} is {z_score:.1f} standard deviations '
                    f'above the company mean ({mean:,.2f}).'
                ),
                severity=self.AMOUNT_ANOMALY_WEIGHT,
                category='amount',
            ))
        elif z_score > 2.5:
            flags.append(FraudFlag(
                code='UNUSUALLY_HIGH_AMOUNT',
                description=(
                    f'Invoice amount {current:,.2f} is significantly above '
                    f'the company average ({mean:,.2f}).'
                ),
                severity=self.AMOUNT_ANOMALY_WEIGHT * 0.5,
                category='amount',
            ))

        return flags

    # ── Layer 4: Pattern Analysis ─────────────────────────────────────────────

    def _check_patterns(self, invoice) -> list[FraudFlag]:
        """Detect suspicious repetition patterns."""
        flags: list[FraudFlag] = []

        if not invoice.customer_id or not invoice.total_amount:
            return flags

        from apps.invoices.models import Invoice
        from datetime import timedelta

        # Same amount billed to same customer >3 times in 30 days
        from django.utils import timezone
        cutoff = invoice.issue_date or timezone.now().date()
        window_start = cutoff - timedelta(days=30)

        repeat_count = Invoice.objects.filter(
            company=invoice.company,
            customer=invoice.customer,
            total_amount=invoice.total_amount,
            issue_date__gte=window_start,
            is_active=True,
        ).exclude(id=invoice.id).count()

        if repeat_count >= 3:
            flags.append(FraudFlag(
                code='REPEATED_AMOUNT_PATTERN',
                description=(
                    f'Same amount ({invoice.total_amount}) billed to this customer '
                    f'{repeat_count} times in the last 30 days.'
                ),
                severity=self.PATTERN_WEIGHT * min(1.0, repeat_count / 5),
                category='pattern',
            ))

        return flags

    # ── Layer 5: Supplier Checks ──────────────────────────────────────────────

    def _check_supplier(self, invoice) -> list[FraudFlag]:
        """Check for suspicious supplier/customer patterns."""
        flags: list[FraudFlag] = []

        # Missing customer TRN on a B2B invoice above AED 10,000
        if (
            getattr(invoice, 'transaction_type', '') == 'b2b'
            and invoice.total_amount
            and float(invoice.total_amount) >= 10_000
            and invoice.customer
            and not getattr(invoice.customer, 'trn', None)
        ):
            flags.append(FraudFlag(
                code='MISSING_BUYER_TRN',
                description='B2B invoice above AED 10,000 but buyer TRN is not recorded.',
                severity=self.SUPPLIER_WEIGHT,
                category='supplier',
            ))

        # Same company as both supplier and customer (self-billing check)
        if invoice.customer_id and invoice.company_id:
            from apps.customers.models import Customer
            try:
                cust = invoice.customer
                cust_trn = getattr(cust, 'trn', None)
                comp_trn = getattr(invoice.company, 'trn', None)
                if cust_trn and comp_trn and cust_trn == comp_trn:
                    flags.append(FraudFlag(
                        code='SELF_BILLING',
                        description='Supplier and customer TRN are identical — possible self-billing.',
                        severity=self.SUPPLIER_WEIGHT * 1.5,
                        category='supplier',
                    ))
            except Exception:
                pass

        return flags

    # ── Layer 6: Timing Analysis ──────────────────────────────────────────────

    def _check_timing(self, invoice) -> list[FraudFlag]:
        """Detect suspicious issue timing."""
        flags: list[FraudFlag] = []

        if not invoice.issue_date:
            return flags

        from django.utils import timezone
        today = timezone.now().date()

        # Backdated more than 30 days
        days_back = (today - invoice.issue_date).days
        if days_back > 30:
            flags.append(FraudFlag(
                code='EXCESSIVE_BACKDATING',
                description=f'Invoice dated {days_back} days ago — exceeds 30-day DCTCE limit.',
                severity=self.TIMING_WEIGHT * min(1.0, days_back / 60),
                category='timing',
            ))

        # Future-dated invoice
        if invoice.issue_date > today:
            flags.append(FraudFlag(
                code='FUTURE_DATED',
                description=f'Invoice issue date is in the future ({invoice.issue_date}).',
                severity=self.TIMING_WEIGHT * 0.5,
                category='timing',
            ))

        return flags

    # ── Layer 7: AI Explanation ───────────────────────────────────────────────

    def _get_ai_explanation(self, invoice, result: FraudAnalysisResult) -> Optional[str]:
        """
        Get a plain-English risk explanation from the LLM for high-risk invoices.
        Non-blocking — returns None on any error.
        """
        try:
            from .registry import get_ai_provider
            from .base import AIMessage

            provider = get_ai_provider()
            flag_text = '\n'.join(
                f'- [{f.code}] {f.description} (severity: {f.severity:.2f})'
                for f in result.flags
            )
            prompt = f"""Analyze this invoice fraud risk summary and provide a concise 2-3 sentence explanation for an admin reviewer.

Invoice: {getattr(invoice, 'invoice_number', 'N/A')}
Amount: {invoice.total_amount} {getattr(invoice, 'currency', 'AED')}
Risk Score: {result.risk_score:.2f} ({result.risk_level.upper()})
Flags:
{flag_text}

Explain the key risks clearly and suggest what the admin should verify."""

            response = provider.chat(
                messages=[AIMessage(role='user', content=prompt)],
                system='You are a UAE e-invoicing fraud analyst. Be concise and specific.',
                max_tokens=300,
                temperature=0.2,
            )
            return response.content
        except Exception as exc:
            logger.warning('AI explanation failed for invoice %s: %s', invoice.id, exc)
            return None

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _score_to_level(score: float) -> str:
        if score >= 0.70:
            return RISK_HIGH
        if score >= 0.30:
            return RISK_MEDIUM
        return RISK_LOW

    @staticmethod
    def _determine_action(score: float, flags: list[FraudFlag]) -> str:
        has_duplicate = any(f.category == 'duplicate' for f in flags)
        if score >= 0.70 or has_duplicate:
            return 'flag'
        if score < 0.30:
            return 'approve'
        return 'review'
