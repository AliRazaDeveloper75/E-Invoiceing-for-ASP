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
        parser.add_argument('--batch', default='', help='Directory of TestFile_*.xml to send in naming order (TC2A.4).')
        parser.add_argument('--large', action='store_true', help='Send a ~10MB payload (TC2A.6).')
        parser.add_argument('--no-validate', action='store_true',
                            help='Skip recipient-certificate trust/revocation validation (NOT recommended).')
        parser.add_argument('--validate-doc', action='store_true',
                            help='Validate the business document against PINT-AE Schematron and '
                                 'refuse to send invalid ones (PINT-AE Business Document Validation).')
        parser.add_argument('--profile', default='billing', choices=['billing', 'selfbilling'],
                            help='PINT-AE profile for --validate-doc (default billing).')

    def handle(self, *args, **opts):
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== AS4 send to Testbed ===\n'))

        # 1. Our signing credentials (loaded once for all payloads)
        signer = AS4MessageSigner()
        signer._load_credentials()
        if signer._cert is None or signer._key is None:
            self.stdout.write(self.style.ERROR('Signing credentials not configured (keystore).'))
            return
        signing_cert, signing_key = signer._cert, signer._key
        sender_ap_id = _cn(signing_cert)
        self.stdout.write(f'Our AP (signer)   : {sender_ap_id}')

        # 2. Determine the payload set (batch dir, single file, large, or sample)
        if opts['batch']:
            files = sorted(glob.glob(os.path.join(opts['batch'], 'TestFile_*.xml')))
            if not files:
                files = sorted(glob.glob(os.path.join(opts['batch'], '*.xml')))
            if not files:
                self.stdout.write(self.style.ERROR(f'No *.xml files found in {opts["batch"]}'))
                return
            self.stdout.write(f'Batch             : {len(files)} files in naming order')
            payloads = [(os.path.basename(f), open(f, 'rb').read()) for f in files]
        elif opts['payload']:
            payloads = [(os.path.basename(opts['payload']), open(opts['payload'], 'rb').read())]
        elif opts['large']:
            p = SAMPLE_INVOICE
            filler = ('<cac:Note>' + 'X' * 100 + '</cac:Note>').encode()
            p = p.replace(b'</Invoice>', filler * 100000 + b'</Invoice>')
            payloads = [('large-sample', p)]
        else:
            payloads = [('sample-invoice', SAMPLE_INVOICE)]

        # 3. Process each payload in order
        summary = []
        ctx = dict(signer=signer, signing_cert=signing_cert, signing_key=signing_key,
                   sender_ap_id=sender_ap_id, opts=opts)
        for idx, (label, payload) in enumerate(payloads, 1):
            self.stdout.write(self.style.MIGRATE_HEADING(
                f'\n----- [{idx}/{len(payloads)}] {label} ({len(payload)} bytes) -----'))
            status = self._process_one(label, payload, ctx)
            summary.append((label, status))

        # 4. Batch summary
        if len(payloads) > 1:
            self.stdout.write(self.style.MIGRATE_HEADING('\n===== Batch summary ====='))
            for label, status in summary:
                style = self.style.SUCCESS if status in ('RECEIPT', 'REJECTED-INVALID-CERT') else self.style.ERROR
                self.stdout.write(style(f'  {label:32s} {status}'))

    def _process_one(self, label, payload, ctx) -> str:
        """Resolve, validate, and (if trusted) send one payload. Returns a status string."""
        opts = ctx['opts']

        # Routing — prefer the SBDH inside the payload
        doc_type, process_id = DOC_TYPE, PROCESS_ID
        original_sender, final_recipient = opts['sender'], opts['receiver']
        sbdh = self._parse_sbdh(payload)
        if sbdh:
            original_sender = sbdh.get('sender') or original_sender
            final_recipient = sbdh.get('receiver') or final_recipient
            doc_type = sbdh.get('doctype') or doc_type
            process_id = sbdh.get('process') or process_id
            self.stdout.write(f'SBDH route        : {original_sender} -> {final_recipient}')

        # Resolve endpoint + recipient cert (SMP lookup unless --endpoint given).
        # The testbed registers its receiver under a WILDCARD doctype (e.g.
        # billing-1@ae-1* or billing-1*), not the exact value carried in the SBDH,
        # so try the exact doctype first then the wildcard candidates. The AS4
        # Action / SBDH keep the EXACT doctype — only endpoint discovery falls back.
        endpoint = opts['endpoint']
        recipient_cert = None
        if not endpoint:
            from services.smp_client import SMPClient
            candidates = [doc_type]
            if '##' in doc_type:
                head, tail = doc_type.split('##', 1)
                if '::' in tail:
                    cust, ver = tail.rsplit('::', 1)
                    for alt in (cust + '*', cust.split('@', 1)[0] + '*'):
                        cand = f'{head}##{alt}::{ver}'
                        if cand not in candidates:
                            candidates.append(cand)
            ep = None
            for cand in candidates:
                self.stdout.write(f'SMP lookup for {final_recipient} [{cand.rsplit("##", 1)[-1]}] ...')
                try:
                    c = SMPClient().lookup(final_recipient, cand)
                except Exception as exc:
                    c = None
                    self.stdout.write(self.style.ERROR(f'  SMP lookup error: {exc}'))
                if c and c.transport_url:
                    ep = c
                    break
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
                return 'NO-ENDPOINT'

        if recipient_cert is None:
            recipient_cert = self._load_recipient_cert(opts['cert'], ctx['signer'])
        if recipient_cert is None:
            self.stdout.write(self.style.ERROR('No recipient cert (SMP/--cert/capture).'))
            return 'NO-CERT'
        recipient_ap_id = _cn(recipient_cert)
        self.stdout.write(f'Recipient AP      : {recipient_ap_id}')
        self.stdout.write(f'Endpoint          : {endpoint}')

        # ── Document gate: validate the PINT-AE business document before sending ──
        # (PINT-AE "Business Document Validation" — refuse to transmit invalid docs.)
        if opts.get('validate_doc'):
            from services.peppol.mls import parse_received_sbd
            from services.peppol.pint_ae.xslt_validator import validate_document
            info = parse_received_sbd(payload)
            if info.business_doc:
                vd = validate_document(info.business_doc, profile=opts.get('profile', 'billing'))
                if not vd.ran:
                    self.stdout.write(self.style.WARNING(
                        '  doc validation did NOT run (Saxon/artifacts missing) — sending anyway.'))
                elif not vd.is_valid:
                    self.stdout.write(self.style.ERROR(
                        f'REJECTED — document failed PINT-AE validation ({len(vd.errors)} error(s)):'))
                    for e in vd.errors[:6]:
                        self.stdout.write(self.style.ERROR(f"    {e.get('id')}: {e.get('text')}"))
                    self.stdout.write(self.style.ERROR('          Message will NOT be sent.'))
                    return 'REJECTED-INVALID-DOC'
                else:
                    self.stdout.write(self.style.SUCCESS('Doc validation    : valid (PINT-AE Schematron)'))

        # ── Trust gate: validate the recipient cert before transmitting (TC2A.4) ──
        if not opts['no_validate']:
            from services.as4.cert_validation import validate_recipient_cert
            vr = validate_recipient_cert(recipient_cert)
            if not vr.valid:
                self.stdout.write(self.style.ERROR(
                    f'REJECTED — recipient certificate is NOT trusted: {vr.reason}'))
                self.stdout.write(self.style.ERROR(
                    '          Message will NOT be sent (invalid certificate handling).'))
                return 'REJECTED-INVALID-CERT'
            self.stdout.write(self.style.SUCCESS(
                f'Cert validation   : trusted (chain_ok={vr.chain_ok}, crl_checked={vr.crl_checked})'))
            for w in vr.warnings:
                self.stdout.write(self.style.WARNING(f'                    warning: {w}'))

        # Build + send
        self.stdout.write('Building encrypted + signed AS4 message...')
        body, content_type = as4sender.build_message(
            payload_xml=payload,
            sender_ap_id=ctx['sender_ap_id'],
            recipient_ap_id=recipient_ap_id,
            original_sender=original_sender,
            final_recipient=final_recipient,
            doc_type=doc_type,
            process_id=process_id,
            agreement_ref=AGREEMENT_REF,
            signing_cert=ctx['signing_cert'],
            signing_key=ctx['signing_key'],
            recipient_cert=recipient_cert,
        )
        self.stdout.write(f'MTOM body bytes   : {len(body)}')

        self.stdout.write('Sending...')
        try:
            resp = as4sender.send(endpoint, body, content_type)
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f'Send failed: {exc}'))
            return 'SEND-FAILED'

        self.stdout.write(f'HTTP status       : {resp.status_code}')
        rb = resp.content or b''
        self.stdout.write(f'Response bytes    : {len(rb)}')

        # Parse the SOAP response: is it a Receipt (success) or an ebMS Error?
        is_receipt = False
        errors = []
        try:
            from lxml import etree as _et
            rdoc = _et.fromstring(rb)
            for el in rdoc.iter():
                ln = _et.QName(el).localname
                if ln == 'Receipt':
                    is_receipt = True
                elif ln == 'Error':
                    errors.append({
                        'code': el.get('errorCode', ''),
                        'short': el.get('shortDescription', ''),
                        'severity': el.get('severity', ''),
                    })
                elif ln in ('Description', 'ErrorDetail') and (el.text or '').strip():
                    errors.append({'detail': el.text.strip()})
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f'(could not parse response XML: {exc})'))

        if is_receipt and not errors:
            self.stdout.write(self.style.SUCCESS('RESULT: RECEIPT received — testbed accepted the message'))
            result = 'RECEIPT'
        elif errors:
            self.stdout.write(self.style.ERROR('RESULT: ebMS ERROR returned by testbed:'))
            for e in errors:
                self.stdout.write(self.style.ERROR(f'  {e}'))
            result = 'EBMS-ERROR'
        else:
            self.stdout.write(self.style.WARNING('RESULT: response is neither a clear Receipt nor Error'))
            result = 'UNCLEAR'

        self.stdout.write('--- response (first 1500 bytes) ---')
        self.stdout.write(rb[:1500].decode('utf-8', 'replace'))
        return result

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
