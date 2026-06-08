"""
Verify a captured inbound AS4 message (from media/as4_debug/) offline.

Replays the exact bytes the PEPPOL Testbed sent and runs our WS-Security
signature verification, printing detailed diagnostics — so we can confirm the
verification logic works against the real message before relying on the live
endpoint.

Usage:
    python manage.py peppol_verify_capture            # latest capture
    python manage.py peppol_verify_capture --file <path>
"""
import os
import glob
import base64
import hashlib

from django.conf import settings
from django.core.management.base import BaseCommand
from lxml import etree

from services.as4.receiver import AS4Receiver
from services.as4.signing import AS4MessageSigner
from services.as4.constants import NS_DS, NS_WSSE, NS_WSU, NS_EBMS3


class Command(BaseCommand):
    help = 'Verify a captured inbound AS4 message offline (media/as4_debug/).'

    def add_arguments(self, parser):
        parser.add_argument('--file', default='', help='Path to a captured .bin file.')

    def handle(self, *args, **opts):
        path = opts['file']
        if not path:
            dbg = os.path.join(settings.MEDIA_ROOT, 'as4_debug')
            files = sorted(glob.glob(os.path.join(dbg, '*.bin')), key=os.path.getmtime)
            if not files:
                self.stdout.write(self.style.ERROR(f'No captures in {dbg}'))
                return
            path = files[-1]

        self.stdout.write(self.style.MIGRATE_HEADING(f'\n=== Verifying capture: {os.path.basename(path)} ===\n'))

        raw = open(path, 'rb').read()
        # Capture format: "Content-Type: <ct>\r\n\r\n" + raw MTOM body
        head, _, body = raw.partition(b'\r\n\r\n')
        content_type = head.decode('utf-8', 'replace').split(':', 1)[1].strip() if b':' in head else ''
        self.stdout.write(f'Content-Type: {content_type[:90]}...')
        self.stdout.write(f'Body bytes  : {len(body)}\n')

        # Split MTOM → soap + attachments
        soap, attachments = AS4Receiver._split_multipart(content_type, body)
        self.stdout.write(f'Attachments : {list(attachments.keys())}')
        envelope = etree.fromstring(soap)

        # Inspect the signature
        signer = AS4MessageSigner()
        security = envelope.find(f'.//{{{NS_WSSE}}}Security')
        sig = security.find(f'{{{NS_DS}}}Signature') if security is not None else None
        if sig is None:
            self.stdout.write(self.style.ERROR('No ds:Signature found.'))
            return

        # Which cert did we resolve?
        cert_bytes = signer._resolve_signing_cert(security, sig)
        if cert_bytes:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            try:
                cert = x509.load_der_x509_certificate(cert_bytes, default_backend())
                self.stdout.write(self.style.MIGRATE_LABEL('-- Resolved signing cert --'))
                self.stdout.write(f'  Subject: {cert.subject.rfc4514_string()}')
                self.stdout.write(f'  Issuer : {cert.issuer.rfc4514_string()}\n')
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f'  cert parse error: {exc}'))
        else:
            self.stdout.write(self.style.ERROR('Could not resolve signing cert.'))

        # Per-reference digest check (diagnostic)
        si = sig.find(f'{{{NS_DS}}}SignedInfo')
        self.stdout.write(self.style.MIGRATE_LABEL('-- Reference digests --'))
        for ref in si.findall(f'{{{NS_DS}}}Reference'):
            uri = ref.get('URI')
            ok = signer._verify_reference(envelope, ref, attachments)
            mark = '[ OK ]' if ok else '[FAIL]'
            style = self.style.SUCCESS if ok else self.style.ERROR
            self.stdout.write(style(f'  {mark} {uri}'))

        # Full verification (SignedInfo signature + digests)
        self.stdout.write(self.style.MIGRATE_LABEL('\n-- Full verification --'))
        valid = signer.verify_inbound(envelope, attachments)
        if valid:
            self.stdout.write(self.style.SUCCESS('  RESULT: SIGNATURE VALID'))
        else:
            self.stdout.write(self.style.ERROR('  RESULT: SIGNATURE INVALID'))

        # Build + sign the AS4 Receipt we would return, and self-verify it.
        self.stdout.write(self.style.MIGRATE_LABEL('\n-- Generated Receipt --'))
        try:
            from services.as4.envelope import build_receipt_signal, envelope_to_bytes
            msg_id = ''
            mi = envelope.find(f'.//{{{NS_EBMS3}}}MessageId')
            if mi is not None:
                msg_id = (mi.text or '').strip()
            refs = AS4Receiver._collect_signature_references(envelope)
            receipt = build_receipt_signal(msg_id, refs)
            signer.sign(receipt, b'', msg_id)
            receipt_bytes = envelope_to_bytes(receipt)
            self.stdout.write(f'  Receipt bytes: {len(receipt_bytes)}')
            self.stdout.write(f'  Signed: {b"Signature" in receipt_bytes}, '
                              f'Receipt: {b"Receipt" in receipt_bytes}, '
                              f'NRI: {b"NonRepudiationInformation" in receipt_bytes}')
            ok = signer.verify_inbound(etree.fromstring(receipt_bytes), {})
            self.stdout.write(('  Self-verify receipt: ' +
                               ('VALID' if ok else 'INVALID')))
            self.stdout.write('\n--- RECEIPT XML ---')
            self.stdout.write(receipt_bytes.decode('utf-8', 'replace'))
        except Exception as exc:
            import traceback
            self.stdout.write(self.style.ERROR(f'  Receipt build failed: {exc}'))
            self.stdout.write(traceback.format_exc())
