"""
Send an encrypted+signed AS4 message to the PEPPOL Testbed (TC2A.3 / TC2A.6).

The recipient (Testbed AP) certificate is auto-extracted from the most recent
captured inbound message (media/as4_debug/) — that's the cert the Testbed
signed with (POP000005) — unless --cert is given. Our signing credentials come
from the configured keystore.

Usage:
    python manage.py peppol_send_testbed --endpoint https://<testbed-as4-url>
    python manage.py peppol_send_testbed --endpoint <url> --cert /path/recipient.pem
    python manage.py peppol_send_testbed --endpoint <url> --large   # ~10MB (TC2A.6)
"""
import glob
import os

from django.conf import settings
from django.core.management.base import BaseCommand
from lxml import etree

from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import NameOID

from services.as4.receiver import AS4Receiver
from services.as4.signing import AS4MessageSigner
from services.as4 import sender as as4sender
from services.as4.constants import NS_WSSE, NS_DS


PROCESS_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'
DOC_TYPE = ('busdox-docid-qns::urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::'
            'Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1')
AGREEMENT_REF = 'urn:fdc:peppol.eu:2017:agreements:tia:ap_provider'

SAMPLE_INVOICE = b"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:peppol:pint:billing-1@ae-1</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>TESTBED-TC2A3-001</cbc:ID>
  <cbc:IssueDate>2026-06-08</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>AED</cbc:DocumentCurrencyCode>
</Invoice>"""


def _cn(cert) -> str:
    try:
        return cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    except Exception:
        return ''


class Command(BaseCommand):
    help = 'Send an encrypted+signed AS4 message to the PEPPOL Testbed (TC2A.3).'

    def add_arguments(self, parser):
        parser.add_argument('--endpoint', default='', help='Testbed AS4 URL (else resolved via SMP lookup).')
        parser.add_argument('--cert', default='', help='Recipient cert PEM/DER (else auto from capture).')
        parser.add_argument('--sender', default='0235:104132266800003', help='originalSender participant id.')
        parser.add_argument('--receiver', default='9922:OPTBCNTRLP1001', help='finalRecipient participant id.')
        parser.add_argument('--payload', default='', help='Path to the exact document to send (from the Testbed ZIP).')
        parser.add_argument('--large', action='store_true', help='Send a ~10MB payload (TC2A.6).')

    def handle(self, *args, **opts):
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== AS4 send to Testbed ===\n'))

        # 1. Our signing credentials
        signer = AS4MessageSigner()
        signer._load_credentials()
        if signer._cert is None or signer._key is None:
            self.stdout.write(self.style.ERROR('Signing credentials not configured (keystore).'))
            return
        signing_cert, signing_key = signer._cert, signer._key
        sender_ap_id = _cn(signing_cert)
        self.stdout.write(f'Our AP (signer)   : {sender_ap_id}')

        # 2. Payload (the exact SBD from the Testbed ZIP)
        if opts['payload']:
            payload = open(opts['payload'], 'rb').read()
            self.stdout.write(f'Payload           : {opts["payload"]} ({len(payload)} bytes)')
        elif opts['large']:
            payload = SAMPLE_INVOICE
            filler = ('<cac:Note>' + 'X' * 100 + '</cac:Note>').encode()
            payload = payload.replace(b'</Invoice>', filler * 100000 + b'</Invoice>')
            self.stdout.write(f'Payload           : large (~{len(payload) // (1024*1024)} MB)')
        else:
            payload = SAMPLE_INVOICE
            self.stdout.write('Payload           : sample invoice')

        # 3. Routing — prefer the SBDH inside the payload
        doc_type, process_id = DOC_TYPE, PROCESS_ID
        original_sender, final_recipient = opts['sender'], opts['receiver']
        sbdh = self._parse_sbdh(payload)
        if sbdh:
            original_sender = sbdh.get('sender') or original_sender
            final_recipient = sbdh.get('receiver') or final_recipient
            doc_type = sbdh.get('doctype') or doc_type
            process_id = sbdh.get('process') or process_id
            self.stdout.write(f'SBDH route        : {original_sender} -> {final_recipient}')

        # 4. Resolve endpoint + recipient cert (SMP lookup unless --endpoint given)
        endpoint = opts['endpoint']
        recipient_cert = None
        if not endpoint:
            self.stdout.write(f'\nSMP lookup for {final_recipient} ...')
            try:
                from services.smp_client import SMPClient
                ep = SMPClient().lookup(final_recipient, doc_type)
            except Exception as exc:
                ep = None
                self.stdout.write(self.style.ERROR(f'SMP lookup error: {exc}'))
            if ep and ep.transport_url:
                endpoint = ep.transport_url
                self.stdout.write(self.style.SUCCESS(f'SMP endpoint      : {endpoint}'))
                if ep.certificate_uid:
                    import base64 as _b
                    try:
                        recipient_cert = x509.load_der_x509_certificate(
                            _b.b64decode(ep.certificate_uid), default_backend())
                    except Exception:
                        recipient_cert = None
            else:
                self.stdout.write(self.style.ERROR(
                    'SMP lookup did not resolve an endpoint. Pass --endpoint explicitly.'))
                return

        if recipient_cert is None:
            recipient_cert = self._load_recipient_cert(opts['cert'], signer)
        if recipient_cert is None:
            self.stdout.write(self.style.ERROR('No recipient cert (SMP/--cert/capture).'))
            return
        recipient_ap_id = _cn(recipient_cert)
        self.stdout.write(f'Recipient AP      : {recipient_ap_id}')
        self.stdout.write(f'Endpoint          : {endpoint}')

        # 5. Build + send
        self.stdout.write('\nBuilding encrypted + signed AS4 message...')
        body, content_type = as4sender.build_message(
            payload_xml=payload,
            sender_ap_id=sender_ap_id,
            recipient_ap_id=recipient_ap_id,
            original_sender=original_sender,
            final_recipient=final_recipient,
            doc_type=doc_type,
            process_id=process_id,
            agreement_ref=AGREEMENT_REF,
            signing_cert=signing_cert,
            signing_key=signing_key,
            recipient_cert=recipient_cert,
        )
        self.stdout.write(f'MTOM body bytes   : {len(body)}')

        self.stdout.write('Sending...')
        try:
            resp = as4sender.send(endpoint, body, content_type)
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f'Send failed: {exc}'))
            return

        self.stdout.write(f'\nHTTP status       : {resp.status_code}')
        rb = resp.content or b''
        self.stdout.write(f'Response bytes    : {len(rb)}')
        has_receipt = b'Receipt' in rb or b'SignalMessage' in rb
        has_error = b'Error' in rb or b'Fault' in rb
        if 200 <= resp.status_code < 300 and has_receipt and not has_error:
            self.stdout.write(self.style.SUCCESS('RESULT: Receipt/SignalMessage received'))
        else:
            self.stdout.write(self.style.ERROR('RESULT: no valid receipt'))
        self.stdout.write('\n--- response (first 1500 bytes) ---')
        self.stdout.write(rb[:1500].decode('utf-8', 'replace'))

    def _load_recipient_cert(self, cert_path, signer):
        if cert_path:
            data = open(cert_path, 'rb').read()
            try:
                return x509.load_pem_x509_certificate(data, default_backend())
            except Exception:
                return x509.load_der_x509_certificate(data, default_backend())
        # Auto-extract from latest capture (the Testbed signing cert)
        dbg = os.path.join(settings.MEDIA_ROOT, 'as4_debug')
        files = sorted(glob.glob(os.path.join(dbg, '*.bin')), key=os.path.getmtime)
        if not files:
            return None
        raw = open(files[-1], 'rb').read()
        head, _, bodyb = raw.partition(b'\r\n\r\n')
        ct = head.decode('utf-8', 'replace').split(':', 1)[1].strip() if b':' in head else ''
        soap, _ = AS4Receiver._split_multipart(ct, bodyb)
        env = etree.fromstring(soap)
        security = env.find(f'.//{{{NS_WSSE}}}Security')
        sig = security.find(f'{{{NS_DS}}}Signature')
        cert_bytes = signer._resolve_signing_cert(security, sig)
        return x509.load_der_x509_certificate(cert_bytes, default_backend()) if cert_bytes else None

    @staticmethod
    def _parse_sbdh(payload: bytes) -> dict:
        """Extract sender/receiver/doctype/process from a StandardBusinessDocument header."""
        SBDH = 'http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader'
        try:
            root = etree.fromstring(payload)
        except Exception:
            return {}
        hdr = root.find(f'{{{SBDH}}}StandardBusinessDocumentHeader')
        if hdr is None:
            return {}
        out = {}
        s = hdr.find(f'{{{SBDH}}}Sender/{{{SBDH}}}Identifier')
        r = hdr.find(f'{{{SBDH}}}Receiver/{{{SBDH}}}Identifier')
        if s is not None and s.text:
            out['sender'] = s.text.strip()
        if r is not None and r.text:
            out['receiver'] = r.text.strip()
        for scope in hdr.findall(f'{{{SBDH}}}BusinessScope/{{{SBDH}}}Scope'):
            t = scope.find(f'{{{SBDH}}}Type')
            ii = scope.find(f'{{{SBDH}}}InstanceIdentifier')
            ident = scope.find(f'{{{SBDH}}}Identifier')
            if t is None or ii is None:
                continue
            ttype = (t.text or '').strip()
            val = (ii.text or '').strip()
            if ttype == 'DOCUMENTID':
                scheme = (ident.text.strip() if ident is not None and ident.text else 'busdox-docid-qns')
                out['doctype'] = f'{scheme}::{val}'
            elif ttype == 'PROCESSID':
                out['process'] = val
        return out
