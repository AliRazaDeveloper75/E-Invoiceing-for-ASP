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
PROCESS_VALUE  = 'urn:peppol:bis:billing'
DOCTYPE_SCHEME = 'peppol-doctype-wildcard'

NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'

# For each kind:
#   doctype  = the EXACT document type we put in the SBDH + AS4 Action (the document
#              we send is a billing-1@ae-1 invoice).
#   lookup   = candidate doctype VALUES to try against the receiver's SMP, in order.
#              The testbed registers the broad wildcard 'billing-1*' (NOT
#              'billing-1@ae-1'), so that must be in the candidate list.
KINDS = {
    'invoice': {
        'standard': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'type': 'Invoice',
        'doctype': ('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice'
                    '##urn:peppol:pint:billing-1@ae-1::2.1'),
        'lookup': [
            'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:peppol:pint:billing-1*::2.1',
            'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:peppol:pint:billing-1@ae-1::2.1',
            'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:peppol:pint:billing-1@ae-1*::2.1',
        ],
    },
    'creditnote': {
        'standard': 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
        'type': 'CreditNote',
        'doctype': ('urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote'
                    '##urn:peppol:pint:billing-1@ae-1::2.1'),
        'lookup': [
            'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:peppol:pint:billing-1*::2.1',
            'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:peppol:pint:billing-1@ae-1::2.1',
            'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:peppol:pint:billing-1@ae-1*::2.1',
        ],
    },
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
        parser.add_argument('--sender', default='0235:104132266800003')
        parser.add_argument('--receiver', default='9922:OPTBCNTRLP1004')
        parser.add_argument('--set-endpoints', action='store_true',
                            help='Rewrite supplier/customer EndpointID to --sender/--receiver.')

    def handle(self, *args, **o):
        kind = KINDS[o['kind']]
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
        self.stdout.write(f'Our AP (signer): {sender_ap_id}')

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
            process_value=PROCESS_VALUE, process_scheme=PROCESS_SCHEME,
            standard=kind['standard'], type_name=kind['type'], type_version='2.1',
            country_c1='AE', mls_type='ALWAYS_SEND',
        )

        msg, ct = as4sender.build_message(
            payload_xml=sbd, sender_ap_id=sender_ap_id, recipient_ap_id=recipient_ap_id,
            original_sender=o['sender'], final_recipient=o['receiver'],
            doc_type=f'{DOCTYPE_SCHEME}::{doctype_value}', process_id=PROCESS_VALUE,
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
