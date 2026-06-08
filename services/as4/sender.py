"""
PEPPOL AS4 outbound sender — encrypted + signed UserMessage.

Mirrors the phase4 message structure observed from the PEPPOL Testbed:
  - payload gzip + AES-128-GCM encrypted, AES key RSA-OAEP wrapped (encryption.py)
  - WS-Security header with:
      * BinarySecurityToken  (recipient cert — referenced by EncryptedKey)
      * xenc:EncryptedKey    (RSA-OAEP wrapped AES key)
      * xenc:EncryptedData   (aes128-gcm, cid attachment, Attachment-Ciphertext-Transform)
      * BinarySecurityToken  (our signing cert — referenced by Signature)
      * ds:Signature         (exc-c14n + InclusiveNamespaces; refs: Messaging, Body, attachment)
  - eb:Messaging / eb:UserMessage (PartyInfo, CollaborationInfo, MessageProperties, PayloadInfo)
  - MTOM multipart: SOAP part + encrypted attachment part

Used by the management command to satisfy Testbed TC2A.3 (AS4 message submission).
"""
import base64
import hashlib
import uuid
from datetime import datetime, timezone

import requests
from lxml import etree

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from .encryption import (
    encrypt_payload,
    ALG_KEY_RSA_OAEP, ALG_MGF1_SHA256, ALG_DIGEST_SHA256, ALG_DATA_AES128GCM,
)

# ── Namespaces ──────────────────────────────────────────────────────────────
S12   = 'http://www.w3.org/2003/05/soap-envelope'
EB    = 'http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/'
WSSE  = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd'
WSU   = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'
WSSE11= 'http://docs.oasis-open.org/wss/oasis-wss-wssecurity-secext-1.1.xsd'
DS    = 'http://www.w3.org/2000/09/xmldsig#'
XENC  = 'http://www.w3.org/2001/04/xmlenc#'
XENC11= 'http://www.w3.org/2009/xmlenc11#'
EC    = 'http://www.w3.org/2001/10/xml-exc-c14n#'

EXC_C14N   = 'http://www.w3.org/2001/10/xml-exc-c14n#'
RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
SHA256     = 'http://www.w3.org/2001/04/xmlenc#sha256'
ATT_CIPHERTEXT_TRANSFORM = 'http://docs.oasis-open.org/wss/oasis-wss-SwAProfile-1.1#Attachment-Ciphertext-Transform'
ATT_CONTENT_SIG_TRANSFORM = 'http://docs.oasis-open.org/wss/oasis-wss-SwAProfile-1.1#Attachment-Content-Signature-Transform'
X509_VT = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3'
B64_ET  = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary'

NSMAP = {'S12': S12, 'eb': EB, 'wsse': WSSE, 'wsu': WSU, 'ds': DS,
         'xenc': XENC, 'xenc11': XENC11, 'ec': EC}

ROLE_INITIATOR = 'http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/initiator'
ROLE_RESPONDER = 'http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/responder'
AP_PARTY_TYPE  = 'urn:fdc:peppol.eu:2017:identifiers:ap'
TS_FMT = '%Y-%m-%dT%H:%M:%S.%fZ'


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode('ascii')


def build_message(
    *,
    payload_xml: bytes,
    sender_ap_id: str,        # eb:From PartyId (our AP seat, e.g. PAE001147)
    recipient_ap_id: str,     # eb:To PartyId (testbed AP, e.g. POP000005)
    original_sender: str,     # participant id, e.g. 0235:104132266800003
    final_recipient: str,     # participant id, e.g. 9922:OPTBCNTRLP1001
    doc_type: str,
    process_id: str,
    agreement_ref: str,
    signing_cert,             # cryptography x509.Certificate (ours)
    signing_key,              # our private key
    recipient_cert,           # cryptography x509.Certificate (testbed) for encryption
) -> tuple[bytes, str]:
    """Build the MTOM body + Content-Type for an encrypted+signed AS4 UserMessage."""
    message_id   = f'{uuid.uuid4()}@e-numerak.ae'
    att_cid      = f'att-{uuid.uuid4()}@cid'
    msg_wsu_id   = f'msg-{uuid.uuid4()}'
    body_wsu_id  = f'body-{uuid.uuid4()}'
    recip_bst_id = f'X509-{uuid.uuid4()}'
    sign_bst_id  = f'X509-{uuid.uuid4()}'
    ek_id        = f'EK-{uuid.uuid4()}'
    ed_id        = f'ED-{uuid.uuid4()}'
    ts           = datetime.now(tz=timezone.utc).strftime(TS_FMT)

    # 1. Encrypt payload for the recipient
    enc = encrypt_payload(payload_xml, recipient_cert.public_key())

    signing_cert_der  = signing_cert.public_bytes(serialization.Encoding.DER)
    recip_cert_der    = recipient_cert.public_bytes(serialization.Encoding.DER)

    # 2. Build envelope
    env = etree.Element(f'{{{S12}}}Envelope', nsmap=NSMAP)
    header = etree.SubElement(env, f'{{{S12}}}Header')
    security = etree.SubElement(header, f'{{{WSSE}}}Security')
    security.set(f'{{{S12}}}mustUnderstand', 'true')

    # 2a. Recipient BST (for EncryptedKey)
    recip_bst = etree.SubElement(security, f'{{{WSSE}}}BinarySecurityToken')
    recip_bst.set('EncodingType', B64_ET)
    recip_bst.set('ValueType', X509_VT)
    recip_bst.set(f'{{{WSU}}}Id', recip_bst_id)
    recip_bst.text = _b64(recip_cert_der)

    # 2b. EncryptedKey
    ek = etree.SubElement(security, f'{{{XENC}}}EncryptedKey')
    ek.set('Id', ek_id)
    em = etree.SubElement(ek, f'{{{XENC}}}EncryptionMethod')
    em.set('Algorithm', ALG_KEY_RSA_OAEP)
    dm = etree.SubElement(em, f'{{{DS}}}DigestMethod'); dm.set('Algorithm', ALG_DIGEST_SHA256)
    mgf = etree.SubElement(em, f'{{{XENC11}}}MGF'); mgf.set('Algorithm', ALG_MGF1_SHA256)
    ki = etree.SubElement(ek, f'{{{DS}}}KeyInfo')
    str_ = etree.SubElement(ki, f'{{{WSSE}}}SecurityTokenReference')
    ref = etree.SubElement(str_, f'{{{WSSE}}}Reference')
    ref.set('URI', f'#{recip_bst_id}'); ref.set('ValueType', X509_VT)
    cd = etree.SubElement(ek, f'{{{XENC}}}CipherData')
    cv = etree.SubElement(cd, f'{{{XENC}}}CipherValue'); cv.text = _b64(enc.encrypted_key)
    rl = etree.SubElement(ek, f'{{{XENC}}}ReferenceList')
    dr = etree.SubElement(rl, f'{{{XENC}}}DataReference'); dr.set('URI', f'#{ed_id}')

    # 2c. EncryptedData (references the cid attachment)
    ed = etree.SubElement(security, f'{{{XENC}}}EncryptedData')
    ed.set('Id', ed_id); ed.set('MimeType', 'application/gzip')
    ed.set('Type', 'http://docs.oasis-open.org/wss/oasis-wss-SwAProfile-1.1#Attachment-Content-Only')
    em2 = etree.SubElement(ed, f'{{{XENC}}}EncryptionMethod'); em2.set('Algorithm', ALG_DATA_AES128GCM)
    ki2 = etree.SubElement(ed, f'{{{DS}}}KeyInfo')
    str2 = etree.SubElement(ki2, f'{{{WSSE}}}SecurityTokenReference')
    str2.set(f'{{{WSSE11}}}TokenType', 'http://docs.oasis-open.org/wss/oasis-wss-soap-message-security-1.1#EncryptedKey')
    ref2 = etree.SubElement(str2, f'{{{WSSE}}}Reference'); ref2.set('URI', f'#{ek_id}')
    cd2 = etree.SubElement(ed, f'{{{XENC}}}CipherData')
    cr = etree.SubElement(cd2, f'{{{XENC}}}CipherReference'); cr.set('URI', f'cid:{att_cid}')
    trs = etree.SubElement(cr, f'{{{XENC}}}Transforms')
    tr = etree.SubElement(trs, f'{{{DS}}}Transform'); tr.set('Algorithm', ATT_CIPHERTEXT_TRANSFORM)

    # 2d. Signing BST (our cert)
    sign_bst = etree.SubElement(security, f'{{{WSSE}}}BinarySecurityToken')
    sign_bst.set('EncodingType', B64_ET)
    sign_bst.set('ValueType', X509_VT)
    sign_bst.set(f'{{{WSU}}}Id', sign_bst_id)
    sign_bst.text = _b64(signing_cert_der)

    # 3. eb:Messaging / UserMessage
    messaging = etree.SubElement(header, f'{{{EB}}}Messaging')
    messaging.set(f'{{{S12}}}mustUnderstand', 'true')
    messaging.set(f'{{{WSU}}}Id', msg_wsu_id)
    um = etree.SubElement(messaging, f'{{{EB}}}UserMessage')
    mi = etree.SubElement(um, f'{{{EB}}}MessageInfo')
    etree.SubElement(mi, f'{{{EB}}}Timestamp').text = ts
    etree.SubElement(mi, f'{{{EB}}}MessageId').text = message_id
    pi = etree.SubElement(um, f'{{{EB}}}PartyInfo')
    frm = etree.SubElement(pi, f'{{{EB}}}From')
    fpid = etree.SubElement(frm, f'{{{EB}}}PartyId'); fpid.set('type', AP_PARTY_TYPE); fpid.text = sender_ap_id
    etree.SubElement(frm, f'{{{EB}}}Role').text = ROLE_INITIATOR
    to = etree.SubElement(pi, f'{{{EB}}}To')
    tpid = etree.SubElement(to, f'{{{EB}}}PartyId'); tpid.set('type', AP_PARTY_TYPE); tpid.text = recipient_ap_id
    etree.SubElement(to, f'{{{EB}}}Role').text = ROLE_RESPONDER
    ci = etree.SubElement(um, f'{{{EB}}}CollaborationInfo')
    etree.SubElement(ci, f'{{{EB}}}AgreementRef').text = agreement_ref
    svc = etree.SubElement(ci, f'{{{EB}}}Service'); svc.set('type', 'cenbii-procid-ubl'); svc.text = process_id
    etree.SubElement(ci, f'{{{EB}}}Action').text = doc_type
    etree.SubElement(ci, f'{{{EB}}}ConversationId').text = str(uuid.uuid4())
    mp = etree.SubElement(um, f'{{{EB}}}MessageProperties')
    p1 = etree.SubElement(mp, f'{{{EB}}}Property'); p1.set('name', 'originalSender'); p1.set('type', 'iso6523-actorid-upis'); p1.text = original_sender
    p2 = etree.SubElement(mp, f'{{{EB}}}Property'); p2.set('name', 'finalRecipient'); p2.set('type', 'iso6523-actorid-upis'); p2.text = final_recipient
    pli = etree.SubElement(um, f'{{{EB}}}PayloadInfo')
    part = etree.SubElement(pli, f'{{{EB}}}PartInfo'); part.set('href', f'cid:{att_cid}')
    pps = etree.SubElement(part, f'{{{EB}}}PartProperties')
    pp1 = etree.SubElement(pps, f'{{{EB}}}Property'); pp1.set('name', 'MimeType'); pp1.text = 'application/xml'
    pp2 = etree.SubElement(pps, f'{{{EB}}}Property'); pp2.set('name', 'CompressionType'); pp2.text = 'application/gzip'

    # 4. Body
    body = etree.SubElement(env, f'{{{S12}}}Body')
    body.set(f'{{{WSU}}}Id', body_wsu_id)

    # 5. Build the Signature skeleton (digests + empty SignatureValue)
    _build_sig_skeleton(security, messaging, body, msg_wsu_id, body_wsu_id,
                        att_cid, enc.encrypted_attachment, sign_bst_id)

    # 6. Normalize namespaces (serialize + reparse), then sign the SignedInfo on
    #    the normalized tree so sign-time C14N matches what a verifier computes
    #    after parsing the transmitted bytes.
    raw = etree.tostring(env, xml_declaration=True, encoding='UTF-8')
    env = etree.fromstring(raw)
    _apply_signature(env, signing_key)

    # 7. MTOM package
    return _mtom(env, enc.encrypted_attachment, att_cid)


def _digest_c14n(el, prefixes=None) -> str:
    if prefixes:
        c = etree.tostring(el, method='c14n', exclusive=True, inclusive_ns_prefixes=prefixes)
    else:
        c = etree.tostring(el, method='c14n', exclusive=True)
    return _b64(hashlib.sha256(c).digest())


def _build_sig_skeleton(security, messaging, body, msg_id, body_id, att_cid, att_bytes, sign_bst_id):
    """Build ds:Signature with SignedInfo (digests) + empty SignatureValue + KeyInfo."""
    sig = etree.SubElement(security, f'{{{DS}}}Signature')
    si = etree.SubElement(sig, f'{{{DS}}}SignedInfo')
    cm = etree.SubElement(si, f'{{{DS}}}CanonicalizationMethod'); cm.set('Algorithm', EXC_C14N)
    inc = etree.SubElement(cm, f'{{{EC}}}InclusiveNamespaces'); inc.set('PrefixList', 'S12')
    sm = etree.SubElement(si, f'{{{DS}}}SignatureMethod'); sm.set('Algorithm', RSA_SHA256)

    def add_ref(uri, digest, transform_alg, prefix_list=None):
        r = etree.SubElement(si, f'{{{DS}}}Reference'); r.set('URI', uri)
        trs = etree.SubElement(r, f'{{{DS}}}Transforms')
        tr = etree.SubElement(trs, f'{{{DS}}}Transform'); tr.set('Algorithm', transform_alg)
        if prefix_list:
            i = etree.SubElement(tr, f'{{{EC}}}InclusiveNamespaces'); i.set('PrefixList', prefix_list)
        dmm = etree.SubElement(r, f'{{{DS}}}DigestMethod'); dmm.set('Algorithm', SHA256)
        dv = etree.SubElement(r, f'{{{DS}}}DigestValue'); dv.text = digest

    add_ref(f'#{msg_id}', _digest_c14n(messaging, ['S12']), EXC_C14N, 'S12')
    add_ref(f'#{body_id}', _digest_c14n(body, None), EXC_C14N)
    add_ref(f'cid:{att_cid}', _b64(hashlib.sha256(att_bytes).digest()), ATT_CONTENT_SIG_TRANSFORM)

    etree.SubElement(sig, f'{{{DS}}}SignatureValue')   # filled by _apply_signature

    ki = etree.SubElement(sig, f'{{{DS}}}KeyInfo')
    str_ = etree.SubElement(ki, f'{{{WSSE}}}SecurityTokenReference')
    ref = etree.SubElement(str_, f'{{{WSSE}}}Reference')
    ref.set('URI', f'#{sign_bst_id}'); ref.set('ValueType', X509_VT)


def _apply_signature(env, key):
    """On a (re-parsed/normalised) envelope, C14N the SignedInfo and fill SignatureValue."""
    si = env.find(f'.//{{{DS}}}Signature/{{{DS}}}SignedInfo')
    cm = si.find(f'{{{DS}}}CanonicalizationMethod')
    inc = cm.find(f'{{{EC}}}InclusiveNamespaces') if cm is not None else None
    prefixes = (inc.get('PrefixList') or '').split() if inc is not None else None
    if prefixes:
        si_c14n = etree.tostring(si, method='c14n', exclusive=True, inclusive_ns_prefixes=prefixes)
    else:
        si_c14n = etree.tostring(si, method='c14n', exclusive=True)
    raw = key.sign(si_c14n, padding.PKCS1v15(), hashes.SHA256())
    sv = env.find(f'.//{{{DS}}}Signature/{{{DS}}}SignatureValue')
    sv.text = _b64(raw)


def _mtom(env, att_bytes, att_cid) -> tuple[bytes, str]:
    soap = etree.tostring(env, xml_declaration=True, encoding='UTF-8')
    boundary = f'----=_Part_{uuid.uuid4().hex}'
    root_cid = f'root-{uuid.uuid4()}@cid'
    parts = []
    parts.append(f'--{boundary}'.encode())
    parts.append(b'Content-Type: application/soap+xml; charset=UTF-8')
    parts.append(b'Content-Transfer-Encoding: binary')
    parts.append(f'Content-ID: <{root_cid}>'.encode())
    parts.append(b'')
    parts.append(soap)
    parts.append(f'--{boundary}'.encode())
    parts.append(b'Content-Type: application/octet-stream')
    parts.append(b'Content-Transfer-Encoding: binary')
    parts.append(f'Content-ID: <{att_cid}>'.encode())
    parts.append(b'')
    parts.append(att_bytes)
    parts.append(f'--{boundary}--'.encode())
    mtom_body = b'\r\n'.join(parts)
    content_type = (f'multipart/related; boundary="{boundary}"; '
                    f'type="application/soap+xml"; start="<{root_cid}>"')
    return mtom_body, content_type


def send(endpoint: str, mtom_body: bytes, content_type: str, timeout: int = 60):
    """POST the MTOM body to the receiving AP. Returns the requests Response."""
    return requests.post(
        endpoint,
        data=mtom_body,
        headers={'Content-Type': content_type, 'SOAPAction': '""'},
        timeout=timeout,
    )
