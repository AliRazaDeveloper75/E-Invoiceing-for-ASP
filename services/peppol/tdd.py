"""
UAE Tax Data Document (TDD) generation + validation — AE TDD 1.0.3.

In the UAE 5-corner (DCTCE) model the buyer/seller Access Point must, after
receiving (or sending) a PINT-AE invoice, generate a **Tax Data Document** and
submit it to the Tax Authority (C5). This module builds that ``pxs:TaxData``
document from a received invoice/credit-note and validates it against the
official OpenPeppol AE TDD schematron.

Spec artifacts (bundled under ``schemas/peppol/uae-tdd/``):
  * peppol-tdd-1.0.0.xsd            — TDD XML Schema (namespace urn:peppol:schema:taxdata:1.0)
  * peppol-ae-tdd-1.0.3.sch         — AE TDD schematron source
  * peppol-ae-tdd-1.0.3.xslt        — compiled SVRL validator (ISO skeleton, XSLT 2.0)

Transport (confirmed via C5 SMP 0242:000006-TESTBED.3001):
  doctype : busdox-docid-qns::urn:peppol:schema:taxdata:1.0::TaxData##urn:peppol:taxdata:ae-1::1.0
  process : cenbii-procid-ubl::urn:peppol:taxreporting
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

from lxml import etree

logger = logging.getLogger(__name__)

# ─── Namespaces ─────────────────────────────────────────────────────────────────
NS_PXS = 'urn:peppol:schema:taxdata:1.0'
NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
NS_CEC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
NS_SBDH = 'http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader'
NS_SVRL = 'http://purl.oclc.org/dsdl/svrl'

_NSMAP = {None: NS_PXS, 'cbc': NS_CBC, 'cac': NS_CAC, 'cec': NS_CEC}

# ─── TDD fixed values ───────────────────────────────────────────────────────────
TDD_CUSTOMIZATION_ID = 'urn:peppol:taxdata:ae-1'
TDD_PROFILE_ID = 'urn:peppol:taxreporting'

# Transport identifiers (for AS4 / SMP)
TDD_DOCTYPE = ('busdox-docid-qns::urn:peppol:schema:taxdata:1.0::TaxData'
               '##urn:peppol:taxdata:ae-1::1.0')
TDD_PROCESS = 'urn:peppol:taxreporting'
TDD_PROCESS_SCHEME = 'cenbii-procid-ubl'

# Invoice AdditionalDocumentReference DocumentTypeCode -> TDD CustomContent BTAE id.
# BTAE-20 = Invoice total amount with VAT in AED (present when doc currency != AED
# and tax currency = AED). The testbed's expected TDD carries this as CustomContent.
_CUSTOM_CONTENT_MAP = {'aedtotal-incl-vat': 'BTAE-20'}

# Code-list values
TDD_TYPE_SUBMIT = 'S'
TDD_TYPE_FAILED = 'F'
TDD_SCOPE_DOMESTIC = 'D'
TDD_ROLE_SENDER = '01'
TDD_ROLE_RECEIVER = '02'

_ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), '..', '..',
                             'schemas', 'peppol', 'uae-tdd', '1.0')
_VALIDATOR_XSLT = os.path.normpath(os.path.join(_ARTIFACT_DIR, 'peppol-ae-tdd-1.0.3.xslt'))


# ─── helpers ────────────────────────────────────────────────────────────────────
def _qn(ns: str, tag: str) -> str:
    return f'{{{ns}}}{tag}'


def _sub(parent, ns: str, tag: str, text=None, **attrib):
    el = etree.SubElement(parent, _qn(ns, tag))
    if text is not None:
        el.text = text
    for k, v in attrib.items():
        el.set(k, v)
    return el


def _split_pid(pid: str):
    """'0235:104132266800003' -> ('0235', '104132266800003')."""
    scheme, _, value = (pid or '').partition(':')
    return scheme, value


def extract_business_doc(sbd_or_doc: bytes):
    """
    Return (instance_identifier, business_doc_element) from a StandardBusinessDocument
    or a bare Invoice/CreditNote. instance_identifier is '' for a bare document.
    """
    root = etree.fromstring(sbd_or_doc if isinstance(sbd_or_doc, bytes)
                            else sbd_or_doc.encode('utf-8'))
    if etree.QName(root).localname == 'StandardBusinessDocument':
        ii_el = root.find(f'{{{NS_SBDH}}}StandardBusinessDocumentHeader/'
                          f'{{{NS_SBDH}}}DocumentIdentification/'
                          f'{{{NS_SBDH}}}InstanceIdentifier')
        instance_id = (ii_el.text or '').strip() if ii_el is not None else ''
        inner = None
        for ch in root:
            if etree.QName(ch).localname != 'StandardBusinessDocumentHeader':
                inner = ch
                break
        return instance_id, inner
    return '', root


# ─── TDD builder ────────────────────────────────────────────────────────────────
def build_tdd(sbd_or_invoice: bytes, *,
              reporter: str,
              receiver: str,
              representative: str,
              reporter_role: str = TDD_ROLE_RECEIVER,
              document_scope: str = TDD_SCOPE_DOMESTIC,
              document_type_code: str = TDD_TYPE_SUBMIT,
              include_reported_document: bool = True,
              transport_header_id: str = '') -> bytes:
    """
    Build an AE TDD (``pxs:TaxData``) from a received PINT-AE Invoice/CreditNote.

    Args:
        sbd_or_invoice:  the received SBD (preferred — carries the InstanceIdentifier)
                         or a bare Invoice/CreditNote.
        reporter:        the reporting participant id  ('0235:104132266800003').
        receiver:        the Tax Authority (C5) SPID    ('0242:000006-TESTBED.3001').
        representative:  the reporter's SP representative SPID ('0242:001147').
        reporter_role:   '01' (sender) or '02' (receiver — default; we received it).
        document_scope:  'D' / 'IP' / 'INP'.
        document_type_code: 'S' / 'R' / 'W' / 'F'.
        transport_header_id: override the TransportHeaderID; default = the SBDH
                         InstanceIdentifier of the received message.

    Returns the serialized TDD XML bytes.
    """
    instance_id, inv = extract_business_doc(sbd_or_invoice)
    if inv is None:
        raise ValueError('No business document found inside the SBD')
    transport_header_id = transport_header_id or instance_id

    inv_local = etree.QName(inv).localname  # 'Invoice' or 'CreditNote'
    type_code_tag = 'CreditNoteTypeCode' if inv_local == 'CreditNote' else 'InvoiceTypeCode'

    def itext(path):
        el = inv.find(path, {'cbc': NS_CBC, 'cac': NS_CAC})
        return el.text if el is not None else None

    dcc = itext('cbc:DocumentCurrencyCode') or 'AED'
    tcc = itext('cbc:TaxCurrencyCode')

    root = etree.Element(_qn(NS_PXS, 'TaxData'), nsmap=_NSMAP)

    # ── TDD header (order per XSD; NO cbc:ID — ibr-tdd-03) ──
    _sub(root, NS_CBC, 'CustomizationID', TDD_CUSTOMIZATION_ID)
    _sub(root, NS_CBC, 'ProfileID', TDD_PROFILE_ID)
    now = datetime.now(timezone.utc)
    _sub(root, NS_CBC, 'IssueDate', now.strftime('%Y-%m-%d'))          # no tz (ibr-tdd-04)
    _sub(root, NS_CBC, 'IssueTime', now.strftime('%H:%M:%S') + 'Z')    # with tz (ibr-tdd-05)
    _sub(root, NS_PXS, 'DocumentTypeCode', document_type_code)
    _sub(root, NS_PXS, 'DocumentScope', document_scope)
    _sub(root, NS_PXS, 'ReporterRole', reporter_role)

    # ReportingParty — only cbc:EndpointID allowed (ibr-tdd-10..13)
    rp = _sub(root, NS_PXS, 'ReportingParty')
    rs, rv = _split_pid(reporter)
    _sub(rp, NS_CBC, 'EndpointID', rv, schemeID=rs)

    # ReceivingParty — only cbc:EndpointID, schemeID MUST be 0242 (ibr-tdd-14..17)
    rcp = _sub(root, NS_PXS, 'ReceivingParty')
    cs, cv = _split_pid(receiver)
    _sub(rcp, NS_CBC, 'EndpointID', cv, schemeID=cs)

    # ReportersRepresentative — exactly one PartyIdentification/ID schemeID 0242 (ibr-tdd-18..21)
    rep = _sub(root, NS_PXS, 'ReportersRepresentative')
    pident = _sub(rep, NS_CAC, 'PartyIdentification')
    es, ev = _split_pid(representative)
    _sub(pident, NS_CBC, 'ID', ev, schemeID=es)

    # ── ReportedTransaction (exactly one — ibr-tdd-09) ──
    rt = _sub(root, NS_PXS, 'ReportedTransaction')
    if transport_header_id:
        _sub(rt, NS_PXS, 'TransportHeaderID', transport_header_id)

    # Unreadable document (e.g. UBL-XSD invalid): ReportedDocument + CustomContent
    # are omitted (optional — ibr-tdd-22); only TransportHeaderID + SourceDocument.
    # Note: a readable-but-invalid (schematron) document is still 'F' BUT keeps the
    # full ReportedDocument, so this is gated on readability, not on the type code.
    if not include_reported_document:
        src = _sub(rt, NS_PXS, 'SourceDocument')
        ext = _sub(src, NS_CEC, 'ExtensionContent')
        import copy
        ext.append(copy.deepcopy(inv))
        return etree.tostring(root, xml_declaration=True, encoding='UTF-8', pretty_print=True)

    rd = _sub(rt, NS_PXS, 'ReportedDocument')
    _sub(rd, NS_CBC, 'CustomizationID', itext('cbc:CustomizationID'))   # ibr-tdd-24
    _sub(rd, NS_CBC, 'ProfileID', itext('cbc:ProfileID'))              # ibr-tdd-25
    _sub(rd, NS_CBC, 'ID', itext('cbc:ID'))                            # ibr-tdd-26
    _sub(rd, NS_CBC, 'UUID', itext('cbc:UUID'))                        # ibr-tdd-27
    _sub(rd, NS_CBC, 'IssueDate', itext('cbc:IssueDate'))             # ibr-tdd-28
    _sub(rd, NS_PXS, 'DocumentTypeCode', itext(f'cbc:{type_code_tag}'))  # ibr-tdd-29
    _sub(rd, NS_CBC, 'DocumentCurrencyCode', dcc)                      # ibr-tdd-30
    if tcc:
        _sub(rd, NS_CBC, 'TaxCurrencyCode', tcc)

    # Seller — only Party/PartyTaxScheme(CompanyID + TaxScheme/ID) (ibr-tdd-39..45)
    sup = _sub(rd, NS_CAC, 'AccountingSupplierParty')
    sup_party = _sub(sup, NS_CAC, 'Party')
    _copy_party_tax_scheme(inv, 'AccountingSupplierParty', sup_party, prefer_vat=True, exactly_one=True)

    # Buyer — Party/PartyTaxScheme (ibr-tdd-46..49); include when present
    cus = _sub(rd, NS_CAC, 'AccountingCustomerParty')
    cus_party = _sub(cus, NS_CAC, 'Party')
    _copy_party_tax_scheme(inv, 'AccountingCustomerParty', cus_party, prefer_vat=True, exactly_one=False)

    # Tax total(s) — only cbc:TaxAmount, one per currency (ibr-tdd-34..36, 51)
    _add_tax_total(rd, inv, dcc)
    if tcc and tcc != dcc:
        _add_tax_total(rd, inv, tcc)

    # Monetary total — TaxExclusiveAmount in document currency only (ibr-tdd-37, 52..54)
    mt = _sub(rd, NS_PXS, 'MonetaryTotal')
    tea = _find_amount(inv, 'cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount', dcc)
    _sub(mt, NS_CBC, 'TaxExclusiveAmount', tea or '0', currencyID=dcc)

    # Custom content — UAE business terms not carried by the standard
    # ReportedDocument. The testbed diff-compares these. BTAE-20 (Invoice total
    # with VAT in AED) lives in the invoice as AdditionalDocumentReference
    # [DocumentTypeCode='aedtotal-incl-vat']/DocumentDescription. (ibr-tdd-55)
    for adr in inv.findall('cac:AdditionalDocumentReference', {'cac': NS_CAC}):
        code = (adr.findtext('cbc:DocumentTypeCode', namespaces={'cbc': NS_CBC}) or '').strip()
        btae_id = _CUSTOM_CONTENT_MAP.get(code)
        if not btae_id:
            continue
        val = (adr.findtext('cbc:DocumentDescription', namespaces={'cbc': NS_CBC}) or '').strip()
        if val:
            cc = _sub(rt, NS_PXS, 'CustomContent')
            _sub(cc, NS_CBC, 'ID', btae_id)
            _sub(cc, NS_CBC, 'Value', val)

    # Source document — full original invoice inside cec:ExtensionContent (ibr-tdd-23, 56, 57)
    src = _sub(rt, NS_PXS, 'SourceDocument')
    ext = _sub(src, NS_CEC, 'ExtensionContent')
    import copy
    ext.append(copy.deepcopy(inv))

    return etree.tostring(root, xml_declaration=True, encoding='UTF-8', pretty_print=True)


def _copy_party_tax_scheme(inv, party_tag, dest_party, *, prefer_vat, exactly_one):
    """Copy a single cac:PartyTaxScheme (CompanyID + TaxScheme/ID only) to dest_party."""
    schemes = inv.findall(f'cac:{party_tag}/cac:Party/cac:PartyTaxScheme',
                          {'cac': NS_CAC})
    if not schemes:
        return
    chosen = None
    if prefer_vat:
        for pts in schemes:
            tsid = pts.find('cac:TaxScheme/cbc:ID', {'cac': NS_CAC, 'cbc': NS_CBC})
            if tsid is not None and (tsid.text or '').strip().upper() == 'VAT':
                chosen = pts
                break
    if chosen is None:
        chosen = schemes[0]
    company_id = chosen.find('cbc:CompanyID', {'cbc': NS_CBC})
    tax_id = chosen.find('cac:TaxScheme/cbc:ID', {'cac': NS_CAC, 'cbc': NS_CBC})
    if company_id is None and not exactly_one:
        return
    pts = _sub(dest_party, NS_CAC, 'PartyTaxScheme')
    if company_id is not None:
        _sub(pts, NS_CBC, 'CompanyID', company_id.text)
    ts = _sub(pts, NS_CAC, 'TaxScheme')
    _sub(ts, NS_CBC, 'ID', tax_id.text if tax_id is not None else 'VAT')


def _find_amount(inv, path, currency):
    """Find an amount element matching currencyID, else the first one; return text."""
    els = inv.findall(path, {'cbc': NS_CBC, 'cac': NS_CAC})
    for e in els:
        if e.get('currencyID') == currency:
            return e.text
    return els[0].text if els else None


def _add_tax_total(rd, inv, currency):
    """Add cac:TaxTotal/cbc:TaxAmount for the given currency (value from the invoice)."""
    amount = None
    for tt in inv.findall('cac:TaxTotal', {'cac': NS_CAC}):
        ta = tt.find('cbc:TaxAmount', {'cbc': NS_CBC})
        if ta is not None and ta.get('currencyID') == currency:
            amount = ta.text
            break
    if amount is None:
        # fall back to the first TaxTotal's amount
        ta = inv.find('cac:TaxTotal/cbc:TaxAmount', {'cac': NS_CAC, 'cbc': NS_CBC})
        amount = ta.text if ta is not None else '0'
    tt = _sub(rd, NS_CAC, 'TaxTotal')
    _sub(tt, NS_CBC, 'TaxAmount', amount, currencyID=currency)


# ─── TDD validation (schematron via compiled SVRL XSLT) ──────────────────────────
@dataclass
class TddValidationResult:
    is_valid: bool = True
    errors: list = field(default_factory=list)     # [{'id','text','location'}]
    warnings: list = field(default_factory=list)
    ran: bool = False

    def __bool__(self):
        return self.is_valid


_TDD_EXECUTABLE = None


def _get_executable():
    global _TDD_EXECUTABLE
    if _TDD_EXECUTABLE is None:
        from saxonche import PySaxonProcessor
        proc = PySaxonProcessor(license=False)
        xp = proc.new_xslt30_processor()
        _TDD_EXECUTABLE = (proc, xp.compile_stylesheet(stylesheet_file=_VALIDATOR_XSLT))
    return _TDD_EXECUTABLE


def validate_tdd(tdd_bytes: bytes) -> TddValidationResult:
    """Validate a TDD against the AE TDD 1.0.3 schematron. Returns TddValidationResult."""
    res = TddValidationResult()
    if isinstance(tdd_bytes, str):
        tdd_bytes = tdd_bytes.encode('utf-8')
    if not os.path.exists(_VALIDATOR_XSLT):
        logger.warning('TDD: validator XSLT missing: %s', _VALIDATOR_XSLT)
        res.warnings.append({'id': 'NO-ARTIFACTS', 'text': 'validator missing', 'location': ''})
        return res
    try:
        proc, executable = _get_executable()
        node = proc.parse_xml(xml_text=tdd_bytes.decode('utf-8'))
        svrl = executable.transform_to_string(xdm_node=node)
    except Exception as exc:
        logger.warning('TDD: validation failed to run: %s', exc)
        res.warnings.append({'id': 'NO-SAXON', 'text': str(exc), 'location': ''})
        return res
    res.ran = True
    doc = etree.fromstring(svrl.encode('utf-8') if isinstance(svrl, str) else svrl)
    for fa in doc.iter(f'{{{NS_SVRL}}}failed-assert'):
        flag = (fa.get('flag') or 'fatal').lower()
        text_el = fa.find(f'{{{NS_SVRL}}}text')
        entry = {
            'id': fa.get('id', ''),
            'location': fa.get('location', ''),
            'text': (text_el.text or '').strip() if text_el is not None else '',
        }
        (res.warnings if flag in ('warning', 'info') else res.errors).append(entry)
    res.is_valid = len(res.errors) == 0
    return res


# ─── TDD submission to the Tax Authority (C5) ────────────────────────────────────
@dataclass
class TddSubmitResult:
    built: bool = False
    valid: bool = False
    sent: bool = False
    receipt: bool = False
    endpoint: str = ''
    receiver: str = ''
    tdd_bytes: bytes = b''
    errors: list = field(default_factory=list)

    def __bool__(self):
        return self.receipt


# Tax Authority (C5) defaults — overridable via Django settings.
DEFAULT_C5_RECEIVER = '0242:000006-TESTBED.3001'
_AGREEMENT_REF = 'urn:fdc:peppol.eu:2017:agreements:tia:ap_provider'


def submit_tdd_for_received(sbd_bytes: bytes, *,
                            c5_receiver: str = '',
                            reporter: str = '',
                            reporter_role: str = TDD_ROLE_RECEIVER,
                            document_scope: str = TDD_SCOPE_DOMESTIC) -> TddSubmitResult:
    """
    Generate an AE TDD for a just-received PINT-AE invoice and submit it to the
    Tax Authority (C5) over AS4.

    reporter defaults to the SBDH Receiver of the inbound message (i.e. us — the
    participant that received the invoice). The reporter's SP representative SPID
    (scheme 0242) is derived from the signing-cert CN.
    """
    from django.conf import settings as _settings
    res = TddSubmitResult()
    c5_receiver = c5_receiver or getattr(_settings, 'PEPPOL_TDD_RECEIVER', '') or DEFAULT_C5_RECEIVER

    # Parse the inbound SBD for reporter (SBDH receiver) + instance id.
    from services.peppol.mls import parse_received_sbd, wrap_in_sbd
    info = parse_received_sbd(sbd_bytes)
    reporter = reporter or info.receiver
    if not reporter:
        res.errors.append('Cannot determine reporter (no SBDH Receiver).')
        return res

    # Our SP representative SPID (scheme 0242), derived from the signing-cert CN.
    import re as _re
    from services.as4.signing import AS4MessageSigner
    from cryptography.x509.oid import NameOID
    signer = AS4MessageSigner()
    signer._load_credentials()
    if signer._cert is None or signer._key is None:
        res.errors.append('Signing credentials not configured (keystore).')
        return res
    try:
        cert_cn = signer._cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    except Exception:
        cert_cn = ''
    m = _re.match(r'^[A-Za-z]{2,4}(\d{4,}.*)$', (cert_cn or '').strip())
    representative = (f'0242:{m.group(1)}' if m
                     else getattr(_settings, 'PEPPOL_SP_ID', '') or '0242:000000')

    # Two independent decisions from validating the received document:
    #   document_type_code: 'S' if the document is VALID, 'F' (failed/TDS) if it
    #     fails EITHER UBL XSD or the PINT-AE schematron.
    #   include_reported_document: True if the document is READABLE (XSD-valid, so
    #     its fields can be extracted), False only when XSD-invalid/not well-formed.
    # => valid: S + ReportedDocument; schematron-invalid: F + ReportedDocument;
    #    syntax/XSD-invalid: F + no ReportedDocument.
    doc_type_code = TDD_TYPE_SUBMIT
    include_rd = True
    try:
        from services.peppol.pint_ae.xslt_validator import validate_xsd, validate_document
        _iid, _inv = extract_business_doc(sbd_bytes)
        if _inv is not None:
            _bd = etree.tostring(_inv)
            _ran, _xsd_err = validate_xsd(_bd)
            if _xsd_err:
                doc_type_code, include_rd = TDD_TYPE_FAILED, False
            else:
                _vd = validate_document(_bd, profile='billing')
                if _vd.ran and not _vd.is_valid:
                    doc_type_code = TDD_TYPE_FAILED
        if doc_type_code == TDD_TYPE_FAILED:
            logger.info('TDD: received document INVALID -> Tax Data Status (F, reported_doc=%s).',
                        include_rd)
    except Exception as exc:
        logger.warning('TDD: source validation error, defaulting to S: %s', exc)

    # 1. Build the TDD / TDS.
    try:
        tdd = build_tdd(sbd_bytes, reporter=reporter, receiver=c5_receiver,
                        representative=representative, reporter_role=reporter_role,
                        document_scope=document_scope, document_type_code=doc_type_code,
                        include_reported_document=include_rd)
    except Exception as exc:
        res.errors.append(f'TDD build failed: {exc}')
        return res
    res.built = True
    res.tdd_bytes = tdd

    # 2. Validate the TDD (do NOT submit an invalid one).
    vd = validate_tdd(tdd)
    if vd.ran and not vd.is_valid:
        res.errors.append(f'TDD failed AE TDD 1.0.3 schematron ({len(vd.errors)} error(s)): '
                          + '; '.join(f"{e['id']}:{e['text'][:80]}" for e in vd.errors[:5]))
        return res
    res.valid = True

    # 3. Wrap the TDD in an SBDH addressed to C5.
    sbd = wrap_in_sbd(
        business_doc=tdd, sender=reporter, receiver=c5_receiver,
        doctype_value=TDD_DOCTYPE.split('::', 1)[1], doctype_scheme=TDD_DOCTYPE.split('::', 1)[0],
        process_value=TDD_PROCESS, process_scheme=TDD_PROCESS_SCHEME,
        standard=NS_PXS, type_name='TaxData', type_version='1.0',
        country_c1='AE', mls_type='ALWAYS_SEND', mls_to=representative,
    )

    # 4. SMP-resolve C5 for the TDD doctype.
    from services.smp_client import SMPClient
    try:
        ep = SMPClient().lookup(c5_receiver, TDD_DOCTYPE)
    except Exception as exc:
        res.errors.append(f'SMP lookup failed for {c5_receiver}: {exc}')
        return res
    if ep is None or not ep.transport_url:
        res.errors.append(f'No TDD receiving capability in SMP for {c5_receiver}.')
        return res
    res.endpoint = ep.transport_url
    res.receiver = c5_receiver

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
        res.errors.append('SMP returned no recipient certificate for C5.')
        return res
    try:
        recipient_ap_id = recipient_cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    except Exception:
        recipient_ap_id = ''

    # 5. Build + send the AS4 message.
    from services.as4 import sender as as4sender
    try:
        body, content_type = as4sender.build_message(
            payload_xml=sbd, sender_ap_id=cert_cn, recipient_ap_id=recipient_ap_id,
            original_sender=reporter, final_recipient=c5_receiver,
            doc_type=TDD_DOCTYPE, process_id=TDD_PROCESS,
            agreement_ref=_AGREEMENT_REF,
            signing_cert=signer._cert, signing_key=signer._key, recipient_cert=recipient_cert,
        )
        resp = as4sender.send(ep.transport_url, body, content_type)
    except Exception as exc:
        res.errors.append(f'AS4 send failed: {exc}')
        return res
    res.sent = True

    # 6. Parse the response (Receipt vs ebMS Error).
    rb = resp.content or b''
    try:
        for el in etree.fromstring(rb).iter():
            ln = etree.QName(el).localname
            if ln == 'Receipt':
                res.receipt = True
            elif ln == 'Error':
                res.errors.append(el.get('shortDescription') or el.get('errorCode') or 'ebMS error')
            elif ln in ('Description', 'ErrorDetail') and (el.text or '').strip():
                res.errors.append(el.text.strip()[:300])
    except Exception:
        pass
    return res
