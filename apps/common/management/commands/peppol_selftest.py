"""
End-to-end AS4 self-test.

Sends a real, signed AS4 message to your own Access Point endpoint over HTTPS
and verifies that a valid, SIGNED AS4 Receipt comes back. This exercises the
full loop the PEPPOL eDelivery Testbed will exercise:

    sign → MTOM package → HTTPS POST → receive → verify signature →
    build signed Receipt → return → parse Receipt

Usage:
    # Against production (default):
    python manage.py peppol_selftest

    # Against a custom endpoint:
    python manage.py peppol_selftest --url https://api.e-numerak.com/api/v1/inbound/as4/
"""
from django.core.management.base import BaseCommand


SAMPLE_INVOICE = b"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:peppol:pint:billing-1@ae-1</cbc:CustomizationID>
  <cbc:ID>SELFTEST-001</cbc:ID>
  <cbc:IssueDate>2026-06-06</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>AED</cbc:DocumentCurrencyCode>
</Invoice>"""


class Command(BaseCommand):
    help = 'Send a signed AS4 message to your own endpoint and verify a signed receipt comes back.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--url',
            default='https://api.e-numerak.com/api/v1/inbound/as4/',
            help='Target AS4 endpoint URL (default: production).',
        )
        parser.add_argument(
            '--sender', default='0235:100000000000003',
            help='Sender PEPPOL participant ID.',
        )
        parser.add_argument(
            '--receiver', default='0235:100000000000004',
            help='Receiver PEPPOL participant ID.',
        )
        parser.add_argument(
            '--insecure', action='store_true',
            help='Skip TLS certificate verification (local testing only).',
        )

    def handle(self, *args, **opts):
        from services.as4.transport import AS4Transport

        url = opts['url']
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== PEPPOL AS4 End-to-End Self-Test ===\n'))
        self.stdout.write(f'Target endpoint : {url}')
        self.stdout.write(f'Sender          : {opts["sender"]}')
        self.stdout.write(f'Receiver        : {opts["receiver"]}\n')

        transport = AS4Transport(
            sender_participant_id=opts['sender'],
            endpoint_url=url,
            ca_bundle=False if opts['insecure'] else None,
        )

        self.stdout.write('Sending signed AS4 message...\n')
        result = transport.send(
            receiver_participant_id=opts['receiver'],
            invoice_xml=SAMPLE_INVOICE,
        )

        # ── Report ─────────────────────────────────────────────────────────────
        self.stdout.write(f'  HTTP status   : {result.http_status}')
        self.stdout.write(f'  Sent msg id   : {result.message_id}')
        self.stdout.write(f'  Receipt msg id: {result.receipt_id or "(none)"}')
        self.stdout.write(f'  Round-trip    : {result.duration_ms} ms')
        if result.error_message:
            self.stdout.write(self.style.WARNING(f'  Note          : {result.error_message}'))

        body = result.response_body or b''
        has_receipt   = b'Receipt' in body
        has_signature = b'Signature' in body
        has_nri       = b'NonRepudiationInformation' in body

        self.stdout.write('')
        self.stdout.write(self._tick('Endpoint reachable & HTTP 2xx', 200 <= result.http_status < 300))
        self.stdout.write(self._tick('Response is an AS4 Receipt', has_receipt))
        self.stdout.write(self._tick('Receipt is SIGNED', has_signature))
        self.stdout.write(self._tick('Non-repudiation info present', has_nri))
        self.stdout.write(self._tick('Receipt MessageId returned', bool(result.receipt_id)))

        all_ok = (
            200 <= result.http_status < 300
            and has_receipt and has_signature and bool(result.receipt_id)
        )

        self.stdout.write('')
        if all_ok:
            self.stdout.write(self.style.SUCCESS(
                'SELF-TEST PASSED - your AP receives AS4 and returns a signed receipt.\n'
                'You are ready to run the PEPPOL eDelivery Testbed.\n'
            ))
        else:
            self.stdout.write(self.style.ERROR(
                'SELF-TEST FAILED - see the checks above.\n'
            ))
            if body:
                self.stdout.write('--- response body (first 800 bytes) ---')
                self.stdout.write(body[:800].decode('utf-8', 'replace'))

    @staticmethod
    def _tick(label: str, ok: bool) -> str:
        mark = '[ OK ]' if ok else '[FAIL]'
        return f'  {mark} {label}'
