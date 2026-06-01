"""
AI Workflow Automation Service.

Evaluates invoices against business rules and AI risk scoring to decide:
  - Auto-approve (low risk, routine invoice, trusted supplier)
  - Flag for review (medium risk, unusual pattern)
  - Block (high risk, duplicate, fraud signals)
  - Route to specific reviewer

Entry point: WorkflowService.evaluate(invoice) → WorkflowDecision
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Decision types ───────────────────────────────────────────────────────────

ACTION_APPROVE = 'approve'
ACTION_FLAG    = 'flag'
ACTION_BLOCK   = 'block'
ACTION_ROUTE   = 'route'     # route to specific reviewer


@dataclass
class WorkflowRule:
    rule_id: str
    description: str
    action: str           # approve | flag | block | route
    priority: int         # lower = higher priority (evaluated first)
    triggered: bool = False


@dataclass
class WorkflowDecision:
    invoice_id: str
    action: str               # approve | flag | block | route
    confidence: float         # 0.0–1.0
    reason: str
    rules_triggered: list[WorkflowRule] = field(default_factory=list)
    routed_to_role: Optional[str] = None    # 'finance_manager' | 'compliance' etc.
    ai_notes: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            'invoice_id':      self.invoice_id,
            'action':          self.action,
            'confidence':      round(self.confidence, 4),
            'reason':          self.reason,
            'routed_to_role':  self.routed_to_role,
            'ai_notes':        self.ai_notes,
            'rules_triggered': [
                {'rule_id': r.rule_id, 'description': r.description, 'action': r.action}
                for r in self.rules_triggered
                if r.triggered
            ],
        }


# ─── Thresholds ───────────────────────────────────────────────────────────────

AUTO_APPROVE_MAX_AMOUNT     = Decimal('10000.00')   # AED — below this, low-risk invoices auto-approve
HIGH_VALUE_REVIEW_THRESHOLD = Decimal('50000.00')   # AED — always route for review
TRUSTED_REPEAT_COUNT        = 5                     # supplier with >=5 clean invoices is "trusted"


# ─── Service ──────────────────────────────────────────────────────────────────

class WorkflowService:
    """
    Decides the automated workflow action for an invoice.

    Evaluation order (highest priority first):
      1. Hard blocks — fraud high-risk, duplicate
      2. Compliance rules — missing TRN, invalid amounts
      3. Amount thresholds — high value requires human review
      4. Supplier trust — repeat clean supplier → lean toward approve
      5. AI risk score (if fraud alert exists)
      6. Default: flag for manual review
    """

    def evaluate(self, invoice) -> WorkflowDecision:
        rules: list[WorkflowRule] = []

        # Rule 1: existing fraud alert — high risk
        fraud_action = self._check_fraud_alert(invoice, rules)
        if fraud_action == ACTION_BLOCK:
            return WorkflowDecision(
                invoice_id=str(invoice.id),
                action=ACTION_BLOCK,
                confidence=0.95,
                reason='Fraud analysis flagged this invoice as high risk.',
                rules_triggered=rules,
                routed_to_role='compliance',
            )

        # Rule 2: compliance — missing supplier TRN
        compliance_issue = self._check_compliance(invoice, rules)
        if compliance_issue:
            return WorkflowDecision(
                invoice_id=str(invoice.id),
                action=ACTION_FLAG,
                confidence=0.90,
                reason=compliance_issue,
                rules_triggered=rules,
                routed_to_role='finance_manager',
            )

        # Rule 3: high-value invoices always get human review
        if invoice.total_amount >= HIGH_VALUE_REVIEW_THRESHOLD:
            r = WorkflowRule('high_value', f'Amount ≥ AED {HIGH_VALUE_REVIEW_THRESHOLD}',
                             ACTION_ROUTE, priority=3, triggered=True)
            rules.append(r)
            return WorkflowDecision(
                invoice_id=str(invoice.id),
                action=ACTION_ROUTE,
                confidence=1.0,
                reason=f'Invoice value AED {invoice.total_amount} requires finance manager approval.',
                rules_triggered=rules,
                routed_to_role='finance_manager',
            )

        # Rule 4: small + trusted supplier → auto-approve
        if invoice.total_amount <= AUTO_APPROVE_MAX_AMOUNT:
            trusted = self._is_trusted_supplier(invoice)
            if trusted:
                r = WorkflowRule('trusted_supplier', 'Repeat supplier with clean history',
                                 ACTION_APPROVE, priority=4, triggered=True)
                rules.append(r)
                no_fraud = WorkflowRule('low_value', f'Amount ≤ AED {AUTO_APPROVE_MAX_AMOUNT}',
                                        ACTION_APPROVE, priority=4, triggered=True)
                rules.append(no_fraud)
                return WorkflowDecision(
                    invoice_id=str(invoice.id),
                    action=ACTION_APPROVE,
                    confidence=0.85,
                    reason='Low-value invoice from trusted supplier — auto-approved.',
                    rules_triggered=rules,
                )

        # Rule 5: medium fraud risk → flag
        if fraud_action == ACTION_FLAG:
            return WorkflowDecision(
                invoice_id=str(invoice.id),
                action=ACTION_FLAG,
                confidence=0.75,
                reason='Fraud analysis detected moderate risk indicators.',
                rules_triggered=rules,
                routed_to_role='finance_manager',
            )

        # Default: flag for manual review
        r = WorkflowRule('default', 'Default: requires manual review', ACTION_FLAG,
                         priority=99, triggered=True)
        rules.append(r)
        return WorkflowDecision(
            invoice_id=str(invoice.id),
            action=ACTION_FLAG,
            confidence=0.60,
            reason='No auto-approve criteria met — routed for manual review.',
            rules_triggered=rules,
            routed_to_role='finance_manager',
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _check_fraud_alert(self, invoice, rules: list) -> str | None:
        try:
            alert = invoice.fraud_alert
        except Exception:
            return None

        if alert.risk_level == 'high':
            r = WorkflowRule('fraud_high', 'AI fraud score ≥ 0.70', ACTION_BLOCK,
                             priority=1, triggered=True)
            rules.append(r)
            return ACTION_BLOCK

        if alert.risk_level == 'medium':
            r = WorkflowRule('fraud_medium', 'AI fraud score 0.30–0.69', ACTION_FLAG,
                             priority=2, triggered=True)
            rules.append(r)
            return ACTION_FLAG

        return None

    def _check_compliance(self, invoice, rules: list) -> str | None:
        company = invoice.company
        customer = invoice.customer

        if not getattr(company, 'vat_number', None):
            r = WorkflowRule('missing_supplier_trn', 'Supplier TRN not set', ACTION_FLAG,
                             priority=2, triggered=True)
            rules.append(r)
            return 'Supplier TRN is missing — invoice may not be UAE-compliant.'

        if invoice.invoice_type == 'tax' and not getattr(customer, 'vat_number', None):
            r = WorkflowRule('missing_customer_trn', 'Customer TRN not set for B2B invoice',
                             ACTION_FLAG, priority=2, triggered=True)
            rules.append(r)
            return 'Customer TRN is missing for a B2B tax invoice.'

        if invoice.total_amount <= Decimal('0'):
            r = WorkflowRule('zero_amount', 'Zero or negative total amount', ACTION_BLOCK,
                             priority=2, triggered=True)
            rules.append(r)
            return 'Invoice total amount is zero or negative.'

        return None

    def _is_trusted_supplier(self, invoice) -> bool:
        from apps.invoices.models import Invoice
        # Count prior clean invoices from same company to same customer
        clean_count = Invoice.objects.filter(
            company=invoice.company,
            customer=invoice.customer,
            is_active=True,
            status='validated',
        ).exclude(id=invoice.id).count()
        return clean_count >= TRUSTED_REPEAT_COUNT


# ─── Workflow automation task helper ─────────────────────────────────────────

def run_workflow_for_invoice(invoice_id: str) -> dict:
    """
    Evaluate workflow for a single invoice and apply the action.
    Called from invoice submission flow and Celery tasks.
    """
    from apps.invoices.models import Invoice

    try:
        invoice = Invoice.objects.select_related(
            'company', 'customer'
        ).prefetch_related('fraud_alert').get(id=invoice_id, is_active=True)
    except Invoice.DoesNotExist:
        return {'success': False, 'error': 'Invoice not found'}

    svc = WorkflowService()
    decision = svc.evaluate(invoice)

    logger.info(
        'Workflow decision: invoice=%s action=%s confidence=%.2f reason=%s',
        invoice.invoice_number, decision.action, decision.confidence, decision.reason,
    )

    return {'success': True, **decision.to_dict()}
