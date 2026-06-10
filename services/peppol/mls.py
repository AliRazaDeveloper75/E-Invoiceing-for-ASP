"""
Peppol Message Level Status (MLS) — eDEC MLS 1.0.

In the UAE PINT-AE billing process every received business document (Invoice /
Credit Note) must be answered with a **Message Level Status** — a UBL
``ApplicationResponse`` carrying a response code:

  * ``AB`` — the document was received and is valid (accepted)
  * ``RE`` — the document was rejected (schema / Schematron / syntax errors)

The MLS is itself a Peppol business document: it is wrapped in an SBDH, routed
to the *original sender* (discovered via SMP), and transmitted over AS4 exactly
like an invoice.

This module provides:
  * ``build_application_response`` — construct the UBL ApplicationResponse
  * ``wrap_in_sbd``               — wrap any business document in an SBDH
  * ``build_mls_sbd``             — convenience: ApplicationResponse → SBD
  * ``send_mls_for_received``     — full inbound→MLS orchestration (validate the
                                    received doc, pick AB/RE, build + AS4-send)

Document type (SMP/SBDH):
  busdox-docid-qns::urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2
  ::ApplicationResponse##urn:peppol:edec:mls:1.0::2.1
Process:
  cenbii-procid-ubl::urn:peppol:edec:mls
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from lxml import etree

logger = logging.getLogger(__name__)

# ─── Namespaces ─────────────────────────────────────────────────────────────────
NS_SBDH = 'http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader'
NS_AR   = 'urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2'
NS_CAC  = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
NS_CBC  = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'

# ─── MLS identifiers ────────────────────────────────────────────────────────────
MLS_CUSTOMIZATION_ID = 'urn:peppol:edec:mls:1.0'
MLS_PROFILE_ID       = 'urn:peppol:edec:mls'
MLS_STANDARD         = NS_AR
MLS_TYPE             = 'ApplicationResponse'
MLS_TYPE_VERSION     = '2.1'
MLS_DOCTYPE_VALUE    = (
    'urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2'
    '::ApplicationResponse##urn:peppol:edec:mls:1.0::2.1'
)
MLS_DOCTYPE_SCHEME = 'busdox-docid-qns'
MLS_DOCTYPE_SMP    = f'{MLS_DOCTYPE_SCHEME}::{MLS_DOCTYPE_VALUE}'
MLS_PROCESS_VALUE  = 'urn:peppol:edec:mls'
MLS_PROCESS_SCHEME = 'cenbii-procid-ubl'
MLS_PROCESS_SMP    = f'{MLS_PROCESS_SCHEME}::{MLS_PROCESS_VALUE}'

# Response codes (Peppol MLS response code list)
MLS_CODE_ACCEPTED = 'AB'   # message acknowledged / accepted
MLS_CODE_REJECTED = 'RE'   # message rejected

PARTICIPANT_AUTHORITY = 'iso6523-actorid-upis'


@dataclass
class ReceivedDocInfo:
    """The facts extracted from a received SBD needed to answer with an MLS."""
    sender: str = ''            # original sender participant (scheme:value) → MLS receiver
    receiver: str = ''          # original receiver (us) → MLS sender
    instance_id: str = ''       # SBDH InstanceIdentifier of the received document
    doc_local_name: str = ''    # 'Invoice' | 'CreditNote'
    business_doc: Optional[bytes] = None   # the inner UBL document bytes
    business_id: str = ''       # cbc:ID of the inner document


@dataclass
class MLSResult:
    """Outcome of building/sending an MLS."""
    sent: bool = False
    response_code: str = ''
    receiver: str = ''
    endpoint: str = ''
    errors: list = field(default_factory=list)
    detail: str = ''


# ─── Parsing the received document ──────────────────────────────────────────────

def parse_received_sbd(sbd_bytes: bytes) -> ReceivedDocInfo:
    """Extract sender/receiver/instance-id and the inner business document."""
    info = ReceivedDocInfo()
    root = etree.fromstring(sbd_bytes)

    def _ln(el) -> str:
        return etree.QName(el).localname

    # The payload may be a full StandardBusinessDocument, or a bare UBL document.
    if _ln(root) == 'StandardBusinessDocument':
        hdr = root.find(f'{{{NS_SBDH}}}StandardBusinessDocumentHeader')
        if hdr is not None:
            s = hdr.find(f'{{{NS_SBDH}}}Sender/{{{NS_SBDH}}}Identifier')
            r = hdr.find(f'{{{NS_SBDH}}}Receiver/{{{NS_SBDH}}}Identifier')
            if s is not None and s.text:
                info.sender = s.text.strip()
            if r is not None and r.text:
                info.receiver = r.text.strip()
            ii = hdr.find(f'{{{NS_SBDH}}}DocumentIdentification/{{{NS_SBDH}}}InstanceIdentifier')
            if ii is not None and ii.text:
                info.instance_id = ii.text.strip()
        # The business document is the first non-SBDH child of the SBD.
        for child in root:
            if _ln(child) != 'StandardBusinessDocumentHeader':
                info.doc_local_name = _ln(child)
                info.business_doc = etree.tostring(child)
                break
    else:
        info.doc_local_name = _ln(root)
        info.business_doc = sbd_bytes

    # cbc:ID of the inner document (used in the MLS DocumentReference).
    if info.business_doc:
        try:
            doc = etree.fromstring(info.business_doc)
            cid = doc.find(f'{{{NS_CBC}}}ID')
            if cid is not None and cid.text:
                info.business_id = cid.text.strip()
        except Exception:
            pass
    return info


# ─── ApplicationResponse construction ───────────────────────────────────────────

def build_application_response(
    *,
    sender_participant: str,
    receiver_participant: str,
    response_code: str,
    reference_id: str,
    reference_instance_id: str = '',
    status_reasons: Optional[list] = None,
    mls_id: Optional[str] = None,
    now: Optional[datetime] = None,
) -> bytes:
    """
    Build a Peppol eDEC MLS ``ApplicationResponse``.

    Args:
        sender_participant:    our participant id (scheme:value) — MLS sender.
        receiver_participant:  original sender id (scheme:value) — MLS receiver.
        response_code:         ``AB`` (accepted) or ``RE`` (rejected).
        reference_id:          cbc:ID of the referenced business document.
        reference_instance_id: SBDH InstanceIdentifier of the referenced document.
        status_reasons:        list of {'code','reason'} for RE responses.
    """
    now = now or datetime.now(timezone.utc)
    mls_id = mls_id or str(uuid.uuid4())
    nsmap = {None: NS_AR, 'cac': NS_CAC, 'cbc': NS_CBC}

    ar = etree.Element(f'{{{NS_AR}}}ApplicationResponse', nsmap=nsmap)

    def cbc(parent, tag, text, **attrs):
        el = etree.SubElement(parent, f'{{{NS_CBC}}}{tag}')
        if text is not None:
            el.text = text
        for k, v in attrs.items():
            el.set(k, v)
        return el

    def cac(parent, tag):
        return etree.SubElement(parent, f'{{{NS_CAC}}}{tag}')

    cbc(ar, 'CustomizationID', MLS_CUSTOMIZATION_ID)
    cbc(ar, 'ProfileID', MLS_PROFILE_ID)
    cbc(ar, 'ID', mls_id)
    cbc(ar, 'IssueDate', now.strftime('%Y-%m-%d'))
    cbc(ar, 'IssueTime', now.strftime('%H:%M:%S') + 'Z')

    def party(tag, participant):
        p = cac(ar, tag)
        scheme, _, value = participant.partition(':')
        if not value:
            value, scheme = scheme, ''
        cbc(p, 'EndpointID', value, schemeID=scheme)
        pid = cac(p, 'PartyIdentification')
        cbc(pid, 'ID', value, schemeID=scheme)
        return p

    party('SenderParty', sender_participant)
    party('ReceiverParty', receiver_participant)

    doc_resp = cac(ar, 'DocumentResponse')
    response = cac(doc_resp, 'Response')
    cbc(response, 'ResponseCode', response_code)
    for sr in (status_reasons or []):
        status = cac(response, 'Status')
        if sr.get('code'):
            cbc(status, 'StatusReasonCode', sr['code'])
        if sr.get('reason'):
            cbc(status, 'StatusReason', sr['reason'][:500])

    doc_ref = cac(doc_resp, 'DocumentReference')
    cbc(doc_ref, 'ID', reference_id or reference_instance_id or mls_id)
    if reference_instance_id:
        cbc(doc_ref, 'UUID', reference_instance_id)

    return etree.tostring(ar, xml_declaration=True, encoding='UTF-8')


# ─── SBDH wrapping ──────────────────────────────────────────────────────────────

def wrap_in_sbd(
    *,
    business_doc: bytes,
    sender: str,
    receiver: str,
    doctype_value: str,
    doctype_scheme: str,
    process_value: str,
    process_scheme: str,
    standard: str,
    type_name: str,
    type_version: str,
    instance_id: Optional[str] = None,
    now: Optional[datetime] = None,
) -> bytes:
    """Wrap a UBL business document in a StandardBusinessDocument (SBDH)."""
    now = now or datetime.now(timezone.utc)
    instance_id = instance_id or str(uuid.uuid4())

    sbd = etree.Element(f'{{{NS_SBDH}}}StandardBusinessDocument', nsmap={None: NS_SBDH})
    hdr = etree.SubElement(sbd, f'{{{NS_SBDH}}}StandardBusinessDocumentHeader')

    def sbdh(parent, tag, text=None):
        el = etree.SubElement(parent, f'{{{NS_SBDH}}}{tag}')
        if text is not None:
            el.text = text
        return el

    sbdh(hdr, 'HeaderVersion', '1.0')
    s = sbdh(hdr, 'Sender')
    sid = sbdh(s, 'Identifier', sender)
    sid.set('Authority', PARTICIPANT_AUTHORITY)
    r = sbdh(hdr, 'Receiver')
    rid = sbdh(r, 'Identifier', receiver)
    rid.set('Authority', PARTICIPANT_AUTHORITY)

    di = sbdh(hdr, 'DocumentIdentification')
    sbdh(di, 'Standard', standard)
    sbdh(di, 'TypeVersion', type_version)
    sbdh(di, 'InstanceIdentifier', instance_id)
    sbdh(di, 'Type', type_name)
    sbdh(di, 'CreationDateAndTime', now.strftime('%Y-%m-%dT%H:%M:%S') + 'Z')

    scope_root = sbdh(hdr, 'BusinessScope')
    for stype, value, ident in (
        ('DOCUMENTID', doctype_value, doctype_scheme),
        ('PROCESSID', process_value, process_scheme),
    ):
        scope = sbdh(scope_root, 'Scope')
        sbdh(scope, 'Type', stype)
        sbdh(scope, 'InstanceIdentifier', value)
        sbdh(scope, 'Identifier', ident)

    # Append the business document (strip any XML declaration first).
    doc_el = etree.fromstring(business_doc)
    sbd.append(doc_el)

    return etree.tostring(sbd, xml_declaration=True, encoding='UTF-8')


def build_mls_sbd(
    *,
    sender_participant: str,
    receiver_participant: str,
    response_code: str,
    reference_id: str,
    reference_instance_id: str = '',
    status_reasons: Optional[list] = None,
) -> bytes:
    """ApplicationResponse → SBDH-wrapped SBD ready for AS4 transmission."""
    ar = build_application_response(
        sender_participant=sender_participant,
        receiver_participant=receiver_participant,
        response_code=response_code,
        reference_id=reference_id,
        reference_instance_id=reference_instance_id,
        status_reasons=status_reasons,
    )
    return wrap_in_sbd(
        business_doc=ar,
        sender=sender_participant,
        receiver=receiver_participant,
        doctype_value=MLS_DOCTYPE_VALUE,
        doctype_scheme=MLS_DOCTYPE_SCHEME,
        process_value=MLS_PROCESS_VALUE,
        process_scheme=MLS_PROCESS_SCHEME,
        standard=MLS_STANDARD,
        type_name=MLS_TYPE,
        type_version=MLS_TYPE_VERSION,
    )


# ─── Validation → response-code decision ────────────────────────────────────────

def decide_response(info: ReceivedDocInfo) -> tuple:
    """
    Validate the received business document and decide the MLS response code.

    Returns (response_code, status_reasons).
    """
    if not info.business_doc:
        return MLS_CODE_REJECTED, [{'code': 'SV', 'reason': 'No business document found in the received message.'}]

    invoice_type = 'creditnote' if info.doc_local_name.lower() == 'creditnote' else 'invoice'
    try:
        from services.peppol_validator import FullPEPPOLValidator
        result = FullPEPPOLValidator().validate(info.business_doc, invoice_type=invoice_type)
    except Exception as exc:
        logger.warning('MLS: validation raised, defaulting to RE: %s', exc)
        return MLS_CODE_REJECTED, [{'code': 'SV', 'reason': f'Validation error: {exc}'}]

    if result.is_valid:
        return MLS_CODE_ACCEPTED, []

    reasons = [{'code': 'BV', 'reason': e if isinstance(e, str) else str(e)} for e in result.errors[:5]]
    return MLS_CODE_REJECTED, reasons or [{'code': 'BV', 'reason': 'Document failed PINT-AE validation.'}]


# ─── Full orchestration: received document → send MLS ───────────────────────────

def send_mls_for_received(sbd_bytes: bytes) -> MLSResult:
    """
    Given a received SBD, validate it, build the appropriate MLS, discover the
    original sender's MLS endpoint via SMP, and transmit it over AS4.
    """
    res = MLSResult()
    try:
        info = parse_received_sbd(sbd_bytes)
    except Exception as exc:
        res.errors.append(f'Could not parse received SBD: {exc}')
        return res

    if not info.sender:
        res.errors.append('Received document has no SBDH Sender — cannot address an MLS.')
        return res

    response_code, status_reasons = decide_response(info)
    res.response_code = response_code
    res.receiver = info.sender

    # Build the MLS SBD (our participant → original sender).
    mls_sbd = build_mls_sbd(
        sender_participant=info.receiver,
        receiver_participant=info.sender,
        response_code=response_code,
        reference_id=info.business_id,
        reference_instance_id=info.instance_id,
        status_reasons=status_reasons,
    )

    # Load our signing credentials.
    from services.as4.signing import AS4MessageSigner
    signer = AS4MessageSigner()
    signer._load_credentials()
    if signer._cert is None or signer._key is None:
        res.errors.append('Signing credentials not configured (keystore).')
        return res
    from cryptography.x509.oid import NameOID
    try:
        sender_ap_id = signer._cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    except Exception:
        sender_ap_id = ''

    # Discover the original sender's MLS receiving endpoint + certificate.
    from services.smp_client import SMPClient
    try:
        ep = SMPClient().lookup(info.sender, MLS_DOCTYPE_SMP)
    except Exception as exc:
        res.errors.append(f'SMP lookup failed for {info.sender}: {exc}')
        return res
    if ep is None or not ep.transport_url:
        res.errors.append(f'No MLS receiving capability found in SMP for {info.sender}.')
        return res
    res.endpoint = ep.transport_url

    # Recipient certificate (from SMP) + trust validation.
    import base64
    from cryptography import x509
    from cryptography.hazmat.backends import default_backend
    recipient_cert = None
    if ep.certificate_uid:
        try:
            recipient_cert = x509.load_der_x509_certificate(
                base64.b64decode(ep.certificate_uid), default_backend())
        except Exception:
            recipient_cert = None
    if recipient_cert is None:
        res.errors.append('SMP returned no recipient certificate for the MLS endpoint.')
        return res
    try:
        from services.as4.cert_validation import validate_recipient_cert
        vr = validate_recipient_cert(recipient_cert)
        if not vr.valid:
            res.errors.append(f'MLS recipient certificate not trusted: {vr.reason}')
            return res
    except Exception as exc:
        logger.warning('MLS: recipient cert validation error: %s', exc)

    try:
        recipient_ap_id = recipient_cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    except Exception:
        recipient_ap_id = ''

    # Build + send the AS4 message carrying the MLS SBD.
    from services.as4 import sender as as4sender
    try:
        body, content_type = as4sender.build_message(
            payload_xml=mls_sbd,
            sender_ap_id=sender_ap_id,
            recipient_ap_id=recipient_ap_id,
            original_sender=info.receiver,
            final_recipient=info.sender,
            doc_type=MLS_DOCTYPE_SMP,
            process_id=MLS_PROCESS_VALUE,
            agreement_ref='urn:fdc:peppol.eu:2017:agreements:tia:ap_provider',
            signing_cert=signer._cert,
            signing_key=signer._key,
            recipient_cert=recipient_cert,
        )
        resp = as4sender.send(ep.transport_url, body, content_type)
    except Exception as exc:
        res.errors.append(f'AS4 send failed: {exc}')
        return res

    res.sent = 200 <= resp.status_code < 300
    res.detail = f'HTTP {resp.status_code}'
    if not res.sent:
        res.errors.append(f'MLS send returned HTTP {resp.status_code}: '
                          f'{(resp.content or b"")[:300].decode("utf-8", "replace")}')
    else:
        logger.info('MLS %s sent to %s (%s)', response_code, info.sender, ep.transport_url)
    return res
