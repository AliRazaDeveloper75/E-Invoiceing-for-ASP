"""
Build / inspect / send a Peppol MLS (Message Level Status) for testing.

Usage:
    # Build an MLS from a received SBD and print it (no send):
    python manage.py peppol_test_mls --from-sbd /tmp/received.xml

    # Build + validate + actually send the MLS over AS4:
    python manage.py peppol_test_mls --from-sbd /tmp/received.xml --send

    # Build a standalone sample MLS (AB) without a source document:
    python manage.py peppol_test_mls --sample
"""
from django.core.management.base import BaseCommand

from services.peppol import mls as mls_mod


class Command(BaseCommand):
    help = 'Build / inspect / send a Peppol MLS (ApplicationResponse).'

    def add_arguments(self, parser):
        parser.add_argument('--from-sbd', default='', help='Path to a received SBD (Invoice/CreditNote).')
        parser.add_argument('--sample', action='store_true', help='Build a standalone sample MLS.')
        parser.add_argument('--send', action='store_true', help='Actually transmit the MLS over AS4.')

    def handle(self, *args, **opts):
        if opts['sample']:
            sbd = mls_mod.build_mls_sbd(
                sender_participant='0235:104132266800003',
                receiver_participant='9922:OPTBCNTRLP1001',
                response_code=mls_mod.MLS_CODE_ACCEPTED,
                reference_id='INV-SAMPLE-001',
                reference_instance_id='11111111-2222-3333-4444-555555555555',
            )
            self.stdout.write(sbd.decode('utf-8'))
            return

        if not opts['from_sbd']:
            self.stdout.write(self.style.ERROR('Provide --from-sbd <path> or --sample.'))
            return

        sbd_in = open(opts['from_sbd'], 'rb').read()
        info = mls_mod.parse_received_sbd(sbd_in)
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Parsed received document ==='))
        self.stdout.write(f'  sender (→MLS receiver): {info.sender}')
        self.stdout.write(f'  receiver (us)         : {info.receiver}')
        self.stdout.write(f'  instance id           : {info.instance_id}')
        self.stdout.write(f'  document              : {info.doc_local_name} (id={info.business_id})')

        code, reasons = mls_mod.decide_response(info)
        self.stdout.write(f'  MLS response code     : {code}')
        for r in reasons:
            self.stdout.write(f'    - {r.get("code")}: {r.get("reason")}')

        mls_sbd = mls_mod.build_mls_sbd(
            sender_participant=info.receiver,
            receiver_participant=info.sender,
            response_code=code,
            reference_id=info.business_id,
            reference_instance_id=info.instance_id,
            status_reasons=reasons,
        )
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Generated MLS SBD ==='))
        self.stdout.write(mls_sbd.decode('utf-8'))

        if opts['send']:
            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Sending MLS over AS4 ==='))
            res = mls_mod.send_mls_for_received(sbd_in)
            style = self.style.SUCCESS if res.sent else self.style.ERROR
            self.stdout.write(style(f'  sent={res.sent} code={res.response_code} '
                                    f'receiver={res.receiver} endpoint={res.endpoint} {res.detail}'))
            for e in res.errors:
                self.stdout.write(self.style.ERROR(f'  error: {e}'))
