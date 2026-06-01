"""
PEPPOL AS4 / ebMS 3.0 namespace and protocol constants.

References:
  PEPPOL AS4 Profile v2.0
  OASIS ebMS 3.0 Core Specification
  OASIS WSS 1.1 (WS-Security)
  PEPPOL BIS Billing 3.0
  UAE PINT-AE billing profile
"""

# ─── XML Namespaces ────────────────────────────────────────────────────────────

NS_SOAP12   = 'http://www.w3.org/2003/05/soap-envelope'
NS_EBMS3    = 'http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/'
NS_WSSE     = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd'
NS_WSU      = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'
NS_DS       = 'http://www.w3.org/2000/09/xmldsig#'
NS_XENC     = 'http://www.w3.org/2001/04/xmlenc#'
NS_EBBP     = 'http://docs.oasis-open.org/ebxml-bp/ebbp-signals-2.0'

# MTOM / MIME
SOAP_CONTENT_TYPE   = 'application/soap+xml'
ATTACHMENT_CONTENT_TYPE = 'application/xml'
MTOM_MULTIPART_TYPE = 'multipart/related'

# Namespace map used across all AS4 XML construction
NS_MAP = {
    'S12':  NS_SOAP12,
    'eb3':  NS_EBMS3,
    'wsse': NS_WSSE,
    'wsu':  NS_WSU,
    'ds':   NS_DS,
    'xenc': NS_XENC,
    'ebbp': NS_EBBP,
}

# ─── WS-Security Token Reference Types ────────────────────────────────────────

WSSE_TOKEN_TYPE_X509V3 = (
    'http://docs.oasis-open.org/wss/2004/01/'
    'oasis-200401-wss-x509-token-profile-1.0#X509v3'
)
WSSE_ENCODING_BASE64    = (
    'http://docs.oasis-open.org/wss/2004/01/'
    'oasis-200401-wss-soap-message-security-1.0#Base64Binary'
)

# ─── Signature Algorithms ──────────────────────────────────────────────────────

ALG_SIGN_RSA_SHA256     = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
ALG_DIGEST_SHA256       = 'http://www.w3.org/2001/04/xmlenc#sha256'
ALG_C14N_EXCLUSIVE      = 'http://www.w3.org/2001/10/xml-exc-c14n#'
ALG_C14N_STANDARD       = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'

# ─── ebMS 3.0 Role URIs ────────────────────────────────────────────────────────

ROLE_INITIATOR  = 'http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/initiator'
ROLE_RESPONDER  = 'http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/responder'

# ─── PEPPOL Document + Process Identifiers ────────────────────────────────────

# PEPPOL BIS Billing 3.0 — UBL Invoice
PEPPOL_DOCTYPE_BIS30_INVOICE = (
    'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
    '::Invoice'
    '##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0'
    '::2.1'
)

# UAE PINT-AE Invoice profile (PEPPOL International — Arabic Emirates)
PEPPOL_DOCTYPE_PINT_AE_INVOICE = (
    'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
    '::Invoice'
    '##urn:peppol:pint:billing-1@ae-1'
    '::2.1'
)

# PEPPOL BIS Billing 3.0 — UBL Credit Note
PEPPOL_DOCTYPE_BIS30_CREDIT_NOTE = (
    'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'
    '::CreditNote'
    '##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0'
    '::2.1'
)

# Process identifier (same for BIS 3.0 and PINT-AE)
PEPPOL_PROCESS_BIS30 = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'

# Service type identifiers
SERVICE_TYPE_CENBII     = 'cenbii-procid-ubl'
PARTY_TYPE_ISO6523      = 'urn:oasis:names:tc:ebcore:partyid-type:iso6523:'

# ─── UAE PEPPOL Scheme ─────────────────────────────────────────────────────────

# UAE scheme identifier (ISO 6523: UAE Ministry of Economy registered scheme)
UAE_PEPPOL_SCHEME = '0235'
UAE_PEPPOL_PARTY_TYPE = f'{PARTY_TYPE_ISO6523}{UAE_PEPPOL_SCHEME}'

# ─── Transport Profile ────────────────────────────────────────────────────────

PEPPOL_TRANSPORT_AS4_V2 = 'peppol-transport-as4-v2_0'

# ─── Payload MIME Content-ID ──────────────────────────────────────────────────

PAYLOAD_CID_TEMPLATE = 'payload-{message_id}@peppol.eu'
PAYLOAD_PART_HREF_TEMPLATE = 'cid:payload-{message_id}@peppol.eu'

# ─── SML / SMP Zones ──────────────────────────────────────────────────────────

SML_ZONE_PRODUCTION = 'edelivery.tech.ec.europa.eu'
SML_ZONE_TEST       = 'acc.edelivery.tech.ec.europa.eu'

# ─── HTTP headers ─────────────────────────────────────────────────────────────

AS4_SOAP_ACTION = '""'   # Empty SOAPAction for AS4

# ─── Receipt / MDN ────────────────────────────────────────────────────────────

RECEIPT_NON_REPUDIATION_NS = 'http://docs.oasis-open.org/ebxml-bp/ebbp-signals-2.0'

# ─── Timestamp format ─────────────────────────────────────────────────────────

TS_FORMAT = '%Y-%m-%dT%H:%M:%SZ'
