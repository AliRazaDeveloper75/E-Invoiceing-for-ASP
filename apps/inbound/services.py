"""
Inbound invoice services — orchestration between models, validation, and email.
"""
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

from .models import (
    Supplier,
    InboundInvoice,
    InboundObservation,
    InboundAuditLog,
    InboundInvoiceItem,
    INBOUND_STATUS_RECEIVED,
    INBOUND_STATUS_VALIDATING,
    INBOUND_STATUS_VALIDATION_FAILED,
    INBOUND_STATUS_PENDING_REVIEW,
    INBOUND_STATUS_APPROVED,
    INBOUND_STATUS_REJECTED,
    SEVERITY_CRITICAL,
    SEVERITY_HIGH,
    SEVERITY_MEDIUM,
)
from .validation import InboundValidationEngine


class InboundInvoiceService:

    # ── Reception ─────────────────────────────────────────────────────────────

    @classmethod
    def create_from_payload(cls, supplier, receiving_company, validated_data: dict, channel: str) -> InboundInvoice:
        """
        Create an InboundInvoice + items from validated serializer data.
        Returns the invoice in RECEIVED status (validation runs async via Celery).
        """
        items_data = validated_data.pop('items', [])

        invoice = InboundInvoice.objects.create(
            supplier          = supplier,
            receiving_company = receiving_company,
            channel           = channel,
            **validated_data,
        )

        # Bulk-create line items
        items = [
            InboundInvoiceItem(
                invoice     = invoice,
                line_number = i.get('line_number', idx + 1),
                description = i['description'],
                quantity    = i['quantity'],
                unit        = i.get('unit', ''),
                unit_price  = i['unit_price'],
                vat_rate    = i.get('vat_rate', '5.00'),
                vat_amount  = round(float(i['quantity']) * float(i['unit_price']) * float(i.get('vat_rate', '5.00')) / 100, 2),
                subtotal    = round(float(i['quantity']) * float(i['unit_price']), 2),
                total_amount= round(float(i['quantity']) * float(i['unit_price']) * (1 + float(i.get('vat_rate', '5.00')) / 100), 2),
            )
            for idx, i in enumerate(items_data)
        ]
        InboundInvoiceItem.objects.bulk_create(items)

        cls._log(invoice, '', INBOUND_STATUS_RECEIVED, 'Invoice received', actor=None)
        return invoice

    # ── PEPPOL AS4 ingestion (Corner 3) ───────────────────────────────────────

    @classmethod
    def ingest_as4_message(cls, *, message_id: str, sender_id: str, receiver_id: str,
                           payload_xml: bytes, signature_valid: bool):
        """
        Persist an invoice received over the PEPPOL AS4 network (Corner 3).

        Defensive by design: it parses what it can from the UBL payload and falls
        back to safe defaults so a received message is NEVER lost — the raw XML is
        always stored for audit/retention even if parsing is imperfect.
        """
        from datetime import date
        from decimal import Decimal
        from lxml import etree
        from apps.companies.models import Company

        raw_text = payload_xml.decode('utf-8', 'ignore') if payload_xml else ''

        def x(root, local: str) -> str:
            """Namespace-agnostic first-match text by local element name."""
            found = root.xpath(f"//*[local-name()='{local}']")
            return found[0].text.strip() if found and found[0].text else ''

        supplier_name = ''
        supplier_trn  = ''
        receiver_trn  = ''
        inv_number    = message_id
        issue_date    = date.today()
        currency      = 'AED'
        subtotal = total_vat = total_amount = Decimal('0.00')

        try:
            root = etree.fromstring(payload_xml)
            inv_number    = x(root, 'ID') or message_id
            supplier_name = x(root, 'RegistrationName') or x(root, 'Name') or sender_id
            # CompanyID appears for both parties; first is usually the supplier TRN
            company_ids = root.xpath("//*[local-name()='CompanyID']")
            if company_ids:
                supplier_trn = (company_ids[0].text or '').strip()
                if len(company_ids) > 1:
                    receiver_trn = (company_ids[1].text or '').strip()
            currency = x(root, 'DocumentCurrencyCode') or 'AED'
            issd = x(root, 'IssueDate')
            if issd:
                try: issue_date = date.fromisoformat(issd)
                except ValueError: pass
            try: total_amount = Decimal(x(root, 'TaxInclusiveAmount') or '0')
            except Exception: pass
            try: subtotal = Decimal(x(root, 'TaxExclusiveAmount') or '0')
            except Exception: pass
            try: total_vat = Decimal(x(root, 'TaxAmount') or '0')
            except Exception: pass
        except Exception as exc:
            logger.warning('AS4 ingest: UBL parse incomplete for %s: %s', message_id, exc)

        # Resolve receiving company by the receiver participant TRN; fall back to first active.
        receiver_trn = receiver_trn or (receiver_id.split(':')[-1] if ':' in receiver_id else receiver_id)
        receiving_company = (
            Company.objects.filter(trn=receiver_trn).first()
            or Company.objects.filter(is_active=True).first()
        )
        if receiving_company is None:
            logger.error('AS4 ingest: no receiving company found for %s — message logged only', message_id)
            return None

        # Find or create the sending supplier under that company.
        supplier_trn = supplier_trn or (sender_id.split(':')[-1] if ':' in sender_id else sender_id)
        supplier = Supplier.objects.filter(trn=supplier_trn, receiving_company=receiving_company).first()
        if supplier is None:
            supplier = Supplier.objects.create(
                name=supplier_name or f'PEPPOL Sender {supplier_trn}',
                trn=supplier_trn or '000000000000000',
                email=f'peppol+{(supplier_trn or message_id)[:30]}@inbound.e-numerak.com',
                receiving_company=receiving_company,
            )

        invoice = InboundInvoice.objects.create(
            supplier=supplier,
            receiving_company=receiving_company,
            channel='as4',
            supplier_invoice_number=inv_number[:100],
            invoice_type='tax_invoice',
            transaction_type='b2b',
            issue_date=issue_date,
            currency=currency[:3] or 'AED',
            subtotal=subtotal,
            total_vat=total_vat,
            total_amount=total_amount,
            raw_xml=raw_text,
            notes=f'Received via PEPPOL AS4. MessageId={message_id}. '
                  f'Signature {"verified" if signature_valid else "NOT verified"}.',
        )
        cls._log(invoice, '', INBOUND_STATUS_RECEIVED, 'Invoice received via PEPPOL AS4', actor=None)
        logger.info('AS4 ingest: stored inbound invoice %s (msg=%s)', invoice.id, message_id)
        return invoice

    # ── Validation ────────────────────────────────────────────────────────────

    @classmethod
    def run_validation(cls, invoice: InboundInvoice):
        """
        Run validation engine synchronously.
        Updates invoice status to PENDING_REVIEW or VALIDATION_FAILED.
        Called from Celery task.
        """
        from_status = invoice.status
        invoice.status = INBOUND_STATUS_VALIDATING
        invoice.save(update_fields=['status', 'updated_at'])
        cls._log(invoice, from_status, INBOUND_STATUS_VALIDATING, 'Validation started')

        # Refresh from DB so all fields are proper Python types (Decimal, date, etc.)
        invoice.refresh_from_db()

        engine = InboundValidationEngine(invoice)
        result = engine.run()
        engine.persist(result)

        if result.has_critical:
            new_status = INBOUND_STATUS_VALIDATION_FAILED
            event = f'Validation failed — {result.critical_count} critical issue(s) found'
        else:
            new_status = INBOUND_STATUS_PENDING_REVIEW
            event = f'Validation passed — score {result.score}/100'
            if result.findings:
                event += f', {len(result.findings)} warning(s)'

        invoice.status = new_status
        invoice.save(update_fields=['status', 'updated_at'])
        cls._log(invoice, INBOUND_STATUS_VALIDATING, new_status, event,
                 detail={'score': result.score, 'findings': len(result.findings),
                         'critical': result.critical_count})

        # Send observation email if there are findings to share
        if result.findings:
            sendable = [f for f in result.findings
                        if f.severity in (SEVERITY_CRITICAL, SEVERITY_HIGH, SEVERITY_MEDIUM)]
            if sendable:
                cls.send_observation_email(invoice)

        return result

    # ── Observation Email ─────────────────────────────────────────────────────

    @classmethod
    def send_observation_email(cls, invoice: InboundInvoice, custom_message: str = ''):
        """Send validation findings to the supplier's registered email."""
        observations = invoice.observations.exclude(
            severity='info'
        ).order_by('severity', 'rule_code')

        if not observations.exists():
            return

        supplier_email = invoice.supplier.email
        if not supplier_email:
            return

        subject = (
            f'[Action Required] Invoice {invoice.supplier_invoice_number} — '
            f'Validation Observations'
        )

        # Build plain-text body
        lines = [
            f'Dear {invoice.supplier.name},',
            '',
            f'We have received your invoice {invoice.supplier_invoice_number} '
            f'dated {invoice.issue_date}.',
            '',
        ]

        if invoice.has_critical_errors:
            lines += [
                'IMPORTANT: Your invoice contains critical issues that must be resolved before',
                'it can be processed. Please correct the issues below and resubmit.',
            ]
        else:
            lines += [
                'Your invoice has been received successfully. However, we have noted the',
                'following observations that you may wish to review:',
            ]

        if custom_message:
            lines += ['', custom_message, '']

        lines += ['', '─' * 60, 'OBSERVATIONS', '─' * 60, '']

        for obs in observations:
            lines += [
                f'[{obs.severity.upper()}] {obs.rule_code}',
                f'Field:   {obs.field_name or "N/A"}',
                f'Issue:   {obs.message}',
            ]
            if obs.suggestion:
                lines.append(f'Action:  {obs.suggestion}')
            if obs.line_number:
                lines.append(f'Line:    {obs.line_number}')
            lines.append('')

        lines += [
            '─' * 60,
            '',
            'If you have questions, please contact us by replying to this email.',
            '',
            'Regards,',
            getattr(settings, 'COMPANY_NAME', 'UAE E-Invoicing Platform'),
            getattr(settings, 'SUPPORT_EMAIL', ''),
        ]

        body = '\n'.join(lines)

        try:
            send_mail(
                subject      = subject,
                message      = body,
                from_email   = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@einvoicing.ae'),
                recipient_list = [supplier_email],
                fail_silently= False,
            )
            # Mark observations as sent and update timestamp
            observations.update(included_in_email=True)
            invoice.observation_sent_at = timezone.now()
            invoice.save(update_fields=['observation_sent_at', 'updated_at'])
        except Exception as exc:
            # Log but don't raise — email failure should not block the workflow
            import logging
            logging.getLogger(__name__).error(
                'Failed to send observation email for invoice %s: %s',
                invoice.supplier_invoice_number, exc
            )

    # ── Approval / Rejection ─────────────────────────────────────────────────

    @classmethod
    def approve(cls, invoice: InboundInvoice, reviewer, notes: str = ''):
        """Internal reviewer approves the invoice for FTA submission."""
        if not invoice.can_approve:
            raise ValueError(f'Invoice cannot be approved in status: {invoice.status}')

        from_status = invoice.status
        invoice.status        = INBOUND_STATUS_APPROVED
        invoice.reviewed_by   = reviewer
        invoice.reviewed_at   = timezone.now()
        invoice.reviewer_notes = notes
        invoice.save(update_fields=[
            'status', 'reviewed_by', 'reviewed_at', 'reviewer_notes', 'updated_at'
        ])
        cls._log(invoice, from_status, INBOUND_STATUS_APPROVED,
                 'Approved by reviewer', actor=reviewer,
                 detail={'notes': notes})

    @classmethod
    def reject(cls, invoice: InboundInvoice, reviewer, notes: str):
        """Internal reviewer rejects the invoice."""
        if not invoice.can_reject:
            raise ValueError(f'Invoice cannot be rejected in status: {invoice.status}')

        from_status = invoice.status
        invoice.status         = INBOUND_STATUS_REJECTED
        invoice.reviewed_by    = reviewer
        invoice.reviewed_at    = timezone.now()
        invoice.reviewer_notes = notes
        invoice.save(update_fields=[
            'status', 'reviewed_by', 'reviewed_at', 'reviewer_notes', 'updated_at'
        ])
        cls._log(invoice, from_status, INBOUND_STATUS_REJECTED,
                 'Rejected by reviewer', actor=reviewer,
                 detail={'notes': notes})

        # Notify supplier of rejection
        cls._send_rejection_notice(invoice, notes)

    @classmethod
    def _send_rejection_notice(cls, invoice: InboundInvoice, notes: str):
        """Email the supplier about the rejection."""
        try:
            send_mail(
                subject      = f'Invoice {invoice.supplier_invoice_number} — Rejected',
                message      = (
                    f'Dear {invoice.supplier.name},\n\n'
                    f'Your invoice {invoice.supplier_invoice_number} has been rejected.\n\n'
                    f'Reason:\n{notes}\n\n'
                    f'Please contact us if you have questions.\n\n'
                    f'Regards,\n'
                    f'{getattr(settings, "COMPANY_NAME", "UAE E-Invoicing Platform")}'
                ),
                from_email   = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@einvoicing.ae'),
                recipient_list = [invoice.supplier.email],
                fail_silently= True,
            )
        except Exception:
            pass

    # ── Audit ─────────────────────────────────────────────────────────────────

    @classmethod
    def _log(cls, invoice: InboundInvoice, from_status: str, to_status: str,
             event: str, actor=None, detail: dict | None = None):
        InboundAuditLog.objects.create(
            invoice     = invoice,
            from_status = from_status,
            to_status   = to_status,
            event       = event,
            actor       = actor,
            detail      = detail,
        )
