"""
Generate an invoice's PEPPOL UBL XML and validate it against the official
PINT-AE 1.0.4 Schematron (Saxon / XSLT 2.0).

This is the same XML your software produces for download / submission, so it
lets you confirm the document is PINT-AE compliant *before* sending it to the
Peppol Testbed (where invalid documents fail the submission test cases).

Usage:
    python manage.py validate_invoice_xml                 # latest invoice
    python manage.py validate_invoice_xml INV-2026-0001   # by invoice number
    python manage.py validate_invoice_xml <uuid>          # by id
    python manage.py validate_invoice_xml INV-... --save out.xml   # also write XML
"""
from django.core.management.base import BaseCommand, CommandError

from apps.invoices.models import Invoice
from services.xml_generator import UAEInvoiceXMLGenerator


class Command(BaseCommand):
    help = 'Generate an invoice XML and validate it against the official PINT-AE Schematron.'

    def add_arguments(self, parser):
        parser.add_argument(
            'invoice', nargs='?', default=None,
            help='Invoice number or UUID. Omit to use the most recently created invoice.',
        )
        parser.add_argument(
            '--save', dest='save', default=None,
            help='Optional path to also write the generated XML to (e.g. out.xml).',
        )
        parser.add_argument(
            '--profile', dest='profile', default='billing',
            choices=['billing', 'selfbilling'],
            help='PINT-AE profile to validate against (default: billing).',
        )

    # ── helpers ─────────────────────────────────────────────────────────────────

    def _resolve_invoice(self, ref):
        if ref is None:
            inv = Invoice.objects.order_by('-created_at').first()
            if inv is None:
                raise CommandError('No invoices found in the database.')
            return inv
        # try invoice_number first, then UUID
        inv = Invoice.objects.filter(invoice_number=ref).first()
        if inv is None:
            inv = Invoice.objects.filter(id=ref).first()
        if inv is None:
            raise CommandError(f'Invoice not found: {ref}')
        return inv

    # ── main ─────────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        invoice = self._resolve_invoice(options['invoice'])

        self.stdout.write(self.style.MIGRATE_HEADING('\n=== PINT-AE XML Validation ===\n'))
        self.stdout.write(f'Invoice      : {invoice.invoice_number}')
        self.stdout.write(f'Type         : {invoice.invoice_type}')
        self.stdout.write(f'Status       : {invoice.status}')
        self.stdout.write(f'Customer     : {getattr(invoice.customer, "name", "—")}')
        self.stdout.write(f'Total        : {invoice.total_amount} {invoice.currency}\n')

        # 1. Generate XML
        try:
            xml_bytes = UAEInvoiceXMLGenerator().generate(invoice)
        except Exception as exc:
            raise CommandError(f'XML generation failed: {exc}')

        self.stdout.write(self.style.SUCCESS(f'[OK] XML generated ({len(xml_bytes)} bytes)'))

        if options['save']:
            with open(options['save'], 'wb') as fh:
                fh.write(xml_bytes)
            self.stdout.write(f'  saved to: {options["save"]}')

        # 2. Validate against the official PINT-AE Schematron
        from services.peppol.pint_ae.xslt_validator import validate_document

        self.stdout.write('\nRunning PINT-AE Schematron (Saxon, XSLT 2.0)…')
        result = validate_document(xml_bytes, profile=options['profile'])

        if not result.ran:
            self.stdout.write(self.style.WARNING(
                '\n[WARN] Validation did NOT run (Saxon or artifacts unavailable). '
                'Warnings below:'
            ))
            for w in result.warnings:
                self.stdout.write(f'   - [{w.get("id")}] {w.get("text")}')
            return

        # 3. Report
        self.stdout.write('')
        if result.is_valid:
            self.stdout.write(self.style.SUCCESS('[VALID] VALID — document passes PINT-AE Schematron.'))
        else:
            self.stdout.write(self.style.ERROR(
                f'[INVALID] INVALID — {len(result.errors)} fatal error(s):\n'
            ))
            for i, e in enumerate(result.errors, 1):
                self.stdout.write(self.style.ERROR(f'  {i}. [{e.get("id") or "—"}] {e.get("text")}'))
                if e.get('location'):
                    self.stdout.write(f'      at: {e["location"]}')

        if result.warnings:
            self.stdout.write(self.style.WARNING(f'\n[WARN] {len(result.warnings)} warning(s):'))
            for w in result.warnings:
                self.stdout.write(f'  - [{w.get("id") or "—"}] {w.get("text")}')

        self.stdout.write('')
