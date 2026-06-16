"""
Inbound invoice services — orchestration between models, validation, and email.
"""
import logging
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)

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

        # Parse the received UBL line items so the review screen + validation engine
        # have the full document (AS4 invoices need items just like API submissions).
        try:
            n = cls._parse_and_store_as4_items(invoice, payload_xml)
            logger.info('AS4 ingest: parsed %d line item(s) for %s', n, invoice.id)
        except Exception as exc:
            logger.warning('AS4 ingest: line-item parse failed for %s: %s', message_id, exc)

        # Run the inbound validation engine → populates score, observations and
        # moves status received → pending_review / validation_failed, so the
        # dashboard shows the full processing result. No supplier email for AS4.
        try:
            cls.run_validation(invoice, send_email=False)
        except Exception as exc:
            logger.warning('AS4 ingest: validation failed for %s: %s', message_id, exc)

        invoice.refresh_from_db()
        return invoice

    @classmethod
    def _parse_and_store_as4_items(cls, invoice, payload_xml) -> int:
        """
        Extract UBL InvoiceLine / CreditNoteLine rows from the received document
        into InboundInvoiceItem records. Namespace-agnostic (works whether or not
        the payload is still wrapped in an SBD).
        """
        from decimal import Decimal, InvalidOperation
        from lxml import etree

        def _dec(val, default='0'):
            try:
                return Decimal((str(val).strip() if val is not None else '') or default)
            except (InvalidOperation, ValueError):
                return Decimal(default)

        root = etree.fromstring(payload_xml)
        lines = root.xpath(
            "//*[local-name()='InvoiceLine'] | //*[local-name()='CreditNoteLine']"
        )

        items = []
        for idx, line in enumerate(lines, start=1):
            def first(path):
                found = line.xpath(path)
                return found[0] if found else None

            id_el    = first("./*[local-name()='ID']")
            qty_el   = first("./*[local-name()='InvoicedQuantity'] | ./*[local-name()='CreditedQuantity']")
            amt_el   = first("./*[local-name()='LineExtensionAmount']")
            name_el  = first(".//*[local-name()='Item']/*[local-name()='Name']")
            price_el = first(".//*[local-name()='Price']/*[local-name()='PriceAmount']")
            pct_el   = first(".//*[local-name()='ClassifiedTaxCategory']/*[local-name()='Percent']")

            line_no = idx
            if id_el is not None and (id_el.text or '').strip().isdigit():
                line_no = int(id_el.text.strip())

            qty        = _dec(qty_el.text if qty_el is not None else '1', '1')
            unit       = (qty_el.get('unitCode') if qty_el is not None else '') or ''
            subtotal   = _dec(amt_el.text if amt_el is not None else '0')
            unit_price = _dec(price_el.text if price_el is not None else '0')
            vat_rate   = _dec(pct_el.text if pct_el is not None else '0')
            desc       = (name_el.text.strip() if (name_el is not None and name_el.text) else 'Item')

            if unit_price == 0 and qty:
                unit_price = subtotal / qty
            vat_amount   = (subtotal * vat_rate / Decimal('100')).quantize(Decimal('0.01'))
            total_amount = (subtotal + vat_amount).quantize(Decimal('0.01'))

            items.append(InboundInvoiceItem(
                invoice=invoice, line_number=line_no, description=desc[:500],
                quantity=qty, unit=unit[:20], unit_price=unit_price,
                vat_rate=vat_rate, vat_amount=vat_amount,
                subtotal=subtotal, total_amount=total_amount,
            ))

        if items:
            InboundInvoiceItem.objects.bulk_create(items)
        return len(items)

    # ── Validation ────────────────────────────────────────────────────────────

    @classmethod
    def run_validation(cls, invoice: InboundInvoice, send_email: bool = True):
        """
        Run validation engine synchronously.
        Updates invoice status to PENDING_REVIEW or VALIDATION_FAILED.
        Called from Celery task (supplier submissions) and AS4 ingest.

        send_email=False skips the supplier observation email — used for AS4/PEPPOL
        reception where the sender is a network participant, not a mailbox.
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
        if send_email and result.findings:
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

        obs_list = list(observations)
        sev_color = {'critical': '#dc2626', 'high': '#ea580c', 'medium': '#ca8a00', 'info': '#2563eb'}
        obs_html = ''
        for obs in obs_list:
            c = sev_color.get(obs.severity, '#2563eb')
            meta = obs.field_name or ''
            if obs.line_number:
                meta = f'{meta} · Line {obs.line_number}'.strip(' ·')
            obs_html += (
                f'<div style="margin:0 0 10px;border:1px solid #e2e8f0;border-left:3px solid {c};'
                f'border-radius:0 8px 8px 0;padding:11px 14px;">'
                f'<div style="font-size:12px;font-weight:700;color:{c};">[{obs.severity.upper()}] '
                f'<span style="font-family:monospace;color:#64748b;">{obs.rule_code}</span>'
                f'{(" · " + meta) if meta else ""}</div>'
                f'<div style="font-size:14px;color:#334155;margin-top:3px;">{obs.message}</div>'
                + (f'<div style="font-size:13px;color:#64748b;margin-top:3px;font-style:italic;">'
                   f'Action: {obs.suggestion}</div>' if obs.suggestion else '')
                + '</div>'
            )

        if invoice.has_critical_errors:
            heading = f'Action required — {invoice.supplier_invoice_number}'
            intro_line = ('Your invoice contains <strong>critical issues</strong> that must be resolved '
                          'before it can be processed. Please correct the items below and resubmit.')
        else:
            heading = f'Validation observations — {invoice.supplier_invoice_number}'
            intro_line = ('Your invoice was received successfully. We noted the following observations '
                          'that you may wish to review.')

        custom_block = (
            f'<p style="margin:0 0 16px;background:#f0f9ff;border-left:3px solid #0ea5e9;'
            f'border-radius:0 6px 6px 0;padding:11px 15px;font-size:14px;color:#0c4a6e;">{custom_message}</p>'
        ) if custom_message else ''

        body_html = (
            f'<p style="margin:0 0 6px;">We have received your invoice '
            f'<strong>{invoice.supplier_invoice_number}</strong> dated {invoice.issue_date}.</p>'
            f'<p style="margin:0 0 16px;">{intro_line}</p>'
            f'{custom_block}'
            f'<p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748b;'
            f'text-transform:uppercase;letter-spacing:0.5px;">Observations ({len(obs_list)})</p>'
            f'{obs_html}'
            f'<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">If you have any questions, '
            f'reply to this email or contact our support team.</p>'
        )

        from services.emails import send_branded_email
        sent = send_branded_email(
            subject=f'[Action Required] Invoice {invoice.supplier_invoice_number} — Validation Observations',
            to=supplier_email,
            heading=heading,
            intro=f'Dear {invoice.supplier.name},',
            body_html=body_html,
            preheader=f'{len(obs_list)} validation observation(s) on invoice {invoice.supplier_invoice_number}.',
        )
        if sent:
            observations.update(included_in_email=True)
            invoice.observation_sent_at = timezone.now()
            invoice.save(update_fields=['observation_sent_at', 'updated_at'])
        else:
            logger.error('Failed to send observation email for invoice %s',
                         invoice.supplier_invoice_number)

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
        if not invoice.supplier.email:
            return
        notes_block = (
            f'<p style="margin:16px 0 0;background:#fef2f2;border-left:3px solid #dc2626;'
            f'border-radius:0 6px 6px 0;padding:12px 15px;font-size:14px;color:#991b1b;">'
            f'<strong>Reason:</strong><br>{notes}</p>'
        ) if notes else ''
        from services.emails import send_branded_email
        send_branded_email(
            subject=f'Invoice {invoice.supplier_invoice_number} — Rejected',
            to=invoice.supplier.email,
            heading='Invoice rejected',
            intro=f'Dear {invoice.supplier.name},',
            body_html=(
                f'<p style="margin:0;">Your invoice <strong>{invoice.supplier_invoice_number}</strong> '
                f'has been rejected after review.</p>{notes_block}'
                f'<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">Please contact us if you have '
                f'any questions or need to resubmit a corrected invoice.</p>'
            ),
            preheader=f'Invoice {invoice.supplier_invoice_number} was rejected.',
        )

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
