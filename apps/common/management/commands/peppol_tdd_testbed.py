"""
Generate an AE TDD from a (received) PINT-AE invoice and submit it to the Tax
Authority (C5) — for the "Billing 1.0.4 & AE TDD 1.0.3" testbed suite.

If the input is a bare Invoice/CreditNote it is first wrapped in an SBDH (so the
TDD can carry the TransportHeaderID and a reporter). If it is already a
StandardBusinessDocument it is used as-is.

Usage:
  python manage.py peppol_tdd_testbed --invoice sample_invoice.xml
  python manage.py peppol_tdd_testbed --invoice received_sbd.xml --c5 0242:000006-TESTBED.3001
  python manage.py peppol_tdd_testbed --invoice sample_invoice.xml --validate-only
"""
import uuid

from django.core.management.base import BaseCommand
from lxml import etree

from services.peppol.tdd import (
    build_tdd, validate_tdd, submit_tdd_for_received, DEFAULT_C5_RECEIVER,
)
from services.peppol.mls import wrap_in_sbd

BILLING_INVOICE_DOCTYPE = ('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice'
                           '##urn:peppol:pint:billing-1@ae-1::2.1')
BILLING_CN_DOCTYPE = ('urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote'
                      '##urn:peppol:pint:billing-1@ae-1::2.1')


class Command(BaseCommand):
    help = 'Generate + submit an AE TDD to the Tax Authority (C5).'

    def add_arguments(self, parser):
        parser.add_argument('--invoice', required=True, help='Invoice/CreditNote or SBD path.')
        parser.add_argument('--c5', default=DEFAULT_C5_RECEIVER, help='Tax Authority (C5) SPID.')
        parser.add_argument('--reporter', default='0235:104132266800003',
                            help='Reporter participant (the invoice receiver). Used when wrapping a bare doc.')
        parser.add_argument('--sender', default='9922:OPTBCNTRLP1005',
                            help='Invoice sender (C1) used when wrapping a bare document.')
        parser.add_argument('--validate-only', action='store_true',
                            help='Only build + schematron-validate the TDD; do not submit.')

    def handle(self, *args, **o):
        body = open(o['invoice'], 'rb').read()
        root = etree.fromstring(body)
        is_sbd = etree.QName(root).localname == 'StandardBusinessDocument'

        if not is_sbd:
            # Wrap the bare business doc in an SBDH so the TDD has a reporter +
            # TransportHeaderID, exactly as it would have arrived inbound.
            local = etree.QName(root).localname
            is_cn = local == 'CreditNote'
            sbd = wrap_in_sbd(
                business_doc=body, sender=o['sender'], receiver=o['reporter'],
                doctype_value=(BILLING_CN_DOCTYPE if is_cn else BILLING_INVOICE_DOCTYPE),
                doctype_scheme='peppol-doctype-wildcard',
                process_value='urn:peppol:bis:billing', process_scheme='cenbii-procid-ubl',
                standard=('urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2' if is_cn
                          else 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'),
                type_name=('CreditNote' if is_cn else 'Invoice'), type_version='2.1',
                country_c1='AE', instance_id=str(uuid.uuid4()),
            )
            self.stdout.write(f'Wrapped bare {local} in SBDH (reporter={o["reporter"]}).')
        else:
            sbd = body
            self.stdout.write('Input is already an SBD.')

        if o['validate_only']:
            tdd = build_tdd(sbd, reporter=o['reporter'], receiver=o['c5'],
                            representative='0242:001147')
            vd = validate_tdd(tdd)
            self.stdout.write(f'TDD built ({len(tdd)} bytes). schematron ran={vd.ran} '
                              f'valid={vd.is_valid} errors={len(vd.errors)}')
            for e in vd.errors:
                self.stdout.write(self.style.ERROR(f"  {e['id']}: {e['text'][:120]}"))
            if vd.is_valid:
                self.stdout.write(self.style.SUCCESS('TDD is VALID (AE TDD 1.0.3).'))
            return

        self.stdout.write(f'Submitting TDD to C5 {o["c5"]} ...')
        res = submit_tdd_for_received(sbd, c5_receiver=o['c5'])
        self.stdout.write(f'built={res.built} valid={res.valid} sent={res.sent} '
                          f'receipt={res.receipt}')
        self.stdout.write(f'endpoint: {res.endpoint}')
        if res.receipt:
            self.stdout.write(self.style.SUCCESS('RESULT: RECEIPT — C5 accepted the TDD.'))
        else:
            self.stdout.write(self.style.ERROR(f'RESULT: not accepted. errors: {res.errors}'))
