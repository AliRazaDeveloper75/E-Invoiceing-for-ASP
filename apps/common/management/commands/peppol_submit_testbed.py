"""
Submit a PINT-AE Invoice / CreditNote to the Peppol Testbed (submission tests).

Flow: set the supplier/customer EndpointIDs to the test sender/receiver, wrap the
business document in an SBDH, resolve the testbed receiver via SMP (trying the
EXACT doctype first, then the wildcard `*` value), then encrypt+sign+send the AS4
message. The testbed replies with an MLS to our AP.

Run this AFTER pressing START on the testbed submission test case (the receiver's
SMP capability is only published once the test is armed).

Usage:
  python manage.py peppol_submit_testbed --invoice sample_invoice.xml
  python manage.py peppol_submit_testbed --kind creditnote --invoice cn.xml \
      --receiver 9922:OPTBCNTRLP1004
"""
import base64

from django.core.management.base import BaseCommand
from lxml import etree

from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import NameOID

from services.as4.signing import AS4MessageSigner
from services.as4 import sender as as4sender
from services.smp_client import SMPClient
from services.peppol.mls import wrap_in_sbd

AGREEMENT_REF  = 'urn:fdc:peppol.eu:2017:agreements:tia:ap_provider'
PROCESS_SCHEME = 'cenbii-procid-ubl'
DOCTYPE_SCHEME = 'peppol-doctype-wildcard'

NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'

# PINT-AE profile → (PINT customization id stem, Peppol process value).
PROFILES = {
    'billing':     ('billing-1@ae-1',     'urn:peppol:bis:billing'),
    'selfbilling': ('selfbilling-1@ae-1', 'urn:peppol:bis:selfbilling'),
}
_STD = {
    'invoice':    ('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2', 'Invoice'),
    'creditnote': ('urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2', 'CreditNote'),
}


def build_kind(profile: str, kind: str) -> dict:
    """Build the doctype + SMP lookup-candidate set for a profile/kind.

    doctype  = the EXACT document type we put in the SBDH + AS4 Action.
    lookup   = candidate doctype VALUES to try against the receiver's SMP, in order.
               The testbed registers a broad wildcard (e.g. 'selfbilling-1*'), NOT the
               exact 'selfbilling-1@ae-1', so the wildcard forms must be candidates.
    """
    cust, _ = PROFILES[profile]
    std, typ = _STD[kind]
    base = f'{std}::{typ}'
    stem = cust.split('@', 1)[0]  # e.g. 'selfbilling-1'
    return {
        'standard': std,
        'type': typ,
        'doctype': f'{base}##urn:peppol:pint:{cust}::2.1',
        'lookup': [
            f'{base}##urn:peppol:pint:{stem}*::2.1',   # selfbilling-1*
            f'{base}##urn:peppol:pint:{cust}::2.1',    # selfbilling-1@ae-1 (exact)
            f'{base}##urn:peppol:pint:{cust}*::2.1',   # selfbilling-1@ae-1*
        ],
    }


def _cn(cert):
    try:
        return cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    except Exception:
        return ''


def _set_endpoint(root, party_tag, participant):
    """Set cac:<party_tag>/cac:Party/cbc:EndpointID to the given scheme:value."""
    scheme, _, value = participant.partition(':')
    party = root.find(f'.//{{{NS_CAC}}}{party_tag}/{{{NS_CAC}}}Party')
    if party is None:
        return
    ep = party.find(f'{{{NS_CBC}}}EndpointID')
    if ep is None:
        ep = etree.SubElement(party, f'{{{NS_CBC}}}EndpointID')
        party.insert(0, ep)
    ep.text = value
    ep.set('schemeID', scheme)


class Command(BaseCommand):
    help = 'Submit a PINT-AE Invoice/CreditNote to the testbed (submission tests).'

    def add_arguments(self, parser):
        parser.add_argument('--invoice', required=True, help='Path to the UBL business document.')
        parser.add_argument('--kind', default='invoice', choices=['invoice', 'creditnote'])
        parser.add_argument('--profile', default='billing', choices=['billing', 'selfbilling'],
                            help='PINT-AE profile: billing (default) or selfbilling.')
        parser.add_argument('--sender', default='0235:104132266800003')
        parser.add_argument('--receiver', default='9922:OPTBCNTRLP1004')
        parser.add_argument('--mls-to', default='',
                            help='SPID (scheme 0242) to receive the return MLS. '
                                 'Default: derived from the signing-cert CN. MUST be '
                                 'registered in the SML/SMP with MLS receiving capability.')
        parser.add_argument('--set-endpoints', action='store_true',
                            help='Rewrite supplier/customer EndpointID to --sender/--receiver.')
        parser.add_argument('--with-tdd', action='store_true',
                            help='Also generate + submit a corresponding AE TDD (as sender, '
                                 'ReporterRole=01) to the Tax Authority C5 (AE TDD suite).')

    def handle(self, *args, **o):
        kind = build_kind(o['profile'], o['kind'])
        process_value = PROFILES[o['profile']][1]
        self.stdout.write(f'Profile: {o["profile"]}  process={process_value}')
        body = open(o['invoice'], 'rb').read()

        if o['set_endpoints']:
            root = etree.fromstring(body)
            _set_endpoint(root, 'AccountingSupplierParty', o['sender'])
            _set_endpoint(root, 'AccountingCustomerParty', o['receiver'])
            body = etree.tostring(root, xml_declaration=True, encoding='UTF-8')
            self.stdout.write(f'Endpoints set: supplier={o["sender"]} customer={o["receiver"]}')

        signer = AS4MessageSigner(); signer._load_credentials()
        if signer._cert is None or signer._key is None:
            self.stderr.write('Signing credentials not configured (keystore).'); return
        sender_ap_id = _cn(signer._cert)

        # The return MLS must be addressed to our Service-Provider ID (scheme 0242),
        # derived from the signing-cert CN (e.g. PAE001147 -> 0242:001147). This SPID
        # MUST be registered in the SML/SMP with MLS receiving capability.
        import re as _re
        _m = _re.match(r'^[A-Za-z]{2,4}(\d{4,}.*)$', (sender_ap_id or '').strip())
        our_spid = o['mls_to'] or (f'0242:{_m.group(1)}' if _m else '')
        self.stdout.write(f'Our AP (signer): {sender_ap_id}   MLS_TO (SPID): {our_spid}')

        # SMP lookup: try the candidate doctype values (the testbed registers the
        # broad 'billing-1*' wildcard). The SBDH + AS4 Action always carry the EXACT
        # document type; only the SMP endpoint discovery uses the matching candidate.
        ep = None
        for dv in kind['lookup']:
            try:
                cand = SMPClient().lookup(o['receiver'], f'{DOCTYPE_SCHEME}::{dv}')
            except Exception as exc:
                cand = None
                self.stdout.write(f'  lookup error [{dv.rsplit("##", 1)[-1]}]: {exc}')
            if cand and cand.transport_url:
                ep = cand
                self.stdout.write(self.style.SUCCESS(
                    f'SMP resolved via [{dv.rsplit("##", 1)[-1]}]: {cand.transport_url}'))
                break
        if not ep:
            self.stderr.write('SMP did not resolve the receiver for any candidate doctype. '
                              'Press START on the testbed test first, then re-run.'); return

        doctype_value = kind['doctype']  # EXACT type for SBDH DOCUMENTID + AS4 Action

        recipient_cert = None
        if ep.certificate_uid:
            try:
                recipient_cert = x509.load_der_x509_certificate(
                    base64.b64decode(ep.certificate_uid), default_backend())
            except Exception:
                recipient_cert = None
        if recipient_cert is None:
            self.stderr.write('SMP returned no recipient certificate.'); return
        recipient_ap_id = _cn(recipient_cert)
        self.stdout.write(f'Recipient AP: {recipient_ap_id}  endpoint: {ep.transport_url}')

        sbd = wrap_in_sbd(
            business_doc=body, sender=o['sender'], receiver=o['receiver'],
            doctype_value=doctype_value, doctype_scheme=DOCTYPE_SCHEME,
            process_value=process_value, process_scheme=PROCESS_SCHEME,
            standard=kind['standard'], type_name=kind['type'], type_version='2.1',
            country_c1='AE', mls_type='ALWAYS_SEND',
            # Return MLS is addressed to our SPID (scheme 0242). The testbed rejects
            # any other scheme ("Expected 0242"), and resolves this SPID in the SML
            # to deliver the MLS — so 0242:00xxxx MUST be registered in our SMP/SML.
            mls_to=our_spid,
        )

        msg, ct = as4sender.build_message(
            payload_xml=sbd, sender_ap_id=sender_ap_id, recipient_ap_id=recipient_ap_id,
            original_sender=o['sender'], final_recipient=o['receiver'],
            doc_type=f'{DOCTYPE_SCHEME}::{doctype_value}', process_id=process_value,
            agreement_ref=AGREEMENT_REF, signing_cert=signer._cert, signing_key=signer._key,
            recipient_cert=recipient_cert,
        )
        self.stdout.write(f'Sending {len(msg)} bytes to {ep.transport_url} ...')
        resp = as4sender.send(ep.transport_url, msg, ct)
        rb = resp.content or b''
        self.stdout.write(f'HTTP {resp.status_code}, {len(rb)} bytes')

        is_receipt, errs = False, []
        try:
            for el in etree.fromstring(rb).iter():
                ln = etree.QName(el).localname
                if ln == 'Receipt':
                    is_receipt = True
                elif ln == 'Error':
                    errs.append(el.get('shortDescription') or el.get('errorCode') or 'error')
        except Exception:
            pass
        if is_receipt and not errs:
            self.stdout.write(self.style.SUCCESS('RESULT: RECEIPT — testbed accepted the submission'))
        elif errs:
            self.stdout.write(self.style.ERROR(f'RESULT: ebMS ERROR: {errs}'))
        else:
            self.stdout.write(self.style.WARNING('RESULT: unclear response'))
        self.stdout.write('--- response (first 1200 bytes) ---')
        self.stdout.write(rb[:1200].decode('utf-8', 'replace'))

        # AE TDD suite: after submitting the invoice, also generate + submit a TDD
        # to the Tax Authority (C5) as the SENDER (ReporterRole=01), referencing the
        # invoice we just sent (its SBDH InstanceIdentifier becomes the TDD
        # TransportHeaderID). The TDD always goes to C5, regardless of --receiver.
        if o.get('with_tdd'):
            from services.peppol.tdd import submit_tdd_for_received, TDD_ROLE_SENDER
            self.stdout.write('\nSubmitting AE TDD (sender, ReporterRole=01) to C5 ...')
            tres = submit_tdd_for_received(sbd, reporter=o['sender'], reporter_role=TDD_ROLE_SENDER)
            if tres.receipt:
                self.stdout.write(self.style.SUCCESS(
                    f'TDD RESULT: RECEIPT — C5 accepted the TDD ({tres.endpoint})'))
            else:
                self.stdout.write(self.style.ERROR(
                    f'TDD RESULT: built={tres.built} valid={tres.valid} sent={tres.sent} '
                    f'errors={tres.errors}'))
