"""
UAE PINT-AE (PEPPOL International Invoice Norm — Arabic Emirates) constants.

UAE PINT-AE is the country extension of the PEPPOL International billing standard
(PINT) for the United Arab Emirates. It extends EN 16931 / PEPPOL BIS 3.0 with
UAE Federal Tax Authority requirements.

References:
  PEPPOL PINT AE Billing 1.0 specification
  UAE Federal Decree-Law No. 8 of 2017 (VAT)
  UAE Federal Decree-Law No. 16 of 2024 (E-Invoicing)
  DCTCE (UAE Digital Economy & Commerce Tax Compliance Engine) specification
"""

# ─── Document Type Identifiers ────────────────────────────────────────────────

# UAE PINT-AE Invoice (primary document type)
PINT_AE_DOCTYPE_INVOICE = (
    'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
    '::Invoice'
    '##urn:peppol:pint:billing-1@ae-1'
    '::2.1'
)

# UAE PINT-AE Credit Note
PINT_AE_DOCTYPE_CREDIT_NOTE = (
    'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'
    '::CreditNote'
    '##urn:peppol:pint:billing-1@ae-1'
    '::2.1'
)

# PEPPOL process identifier (same as BIS 3.0)
PINT_AE_PROCESS_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'

# UAE PEPPOL scheme identifier (ISO 6523)
UAE_PEPPOL_SCHEME = '0235'

# ─── Invoice Type Codes (UN/CEFACT) ──────────────────────────────────────────

INVOICE_TYPE_TAX_INVOICE   = '380'   # Standard commercial invoice (B2B)
INVOICE_TYPE_CREDIT_NOTE   = '381'   # Credit note (correction of over-charged invoice)
INVOICE_TYPE_DEBIT_NOTE    = '383'   # Debit note (correction of under-charged invoice)
INVOICE_TYPE_SELF_BILLED   = '389'   # Self-billed invoice (buyer-initiated)

INVOICE_TYPE_CHOICES = {
    INVOICE_TYPE_TAX_INVOICE:  'Tax Invoice',
    INVOICE_TYPE_CREDIT_NOTE:  'Credit Note',
    INVOICE_TYPE_DEBIT_NOTE:   'Debit Note',
    INVOICE_TYPE_SELF_BILLED:  'Self-Billed Invoice',
}

# ─── VAT Category Codes ───────────────────────────────────────────────────────

VAT_CATEGORY_STANDARD   = 'S'    # Standard rate (5% UAE VAT)
VAT_CATEGORY_ZERO       = 'Z'    # Zero-rated (exports, certain sectors)
VAT_CATEGORY_EXEMPT     = 'E'    # VAT-exempt (specific goods/services)
VAT_CATEGORY_OUT_SCOPE  = 'O'    # Out of scope of VAT
VAT_CATEGORY_REVERSE    = 'AE'   # VAT reverse charge

VAT_RATE_STANDARD = '0.05'   # 5% (always as decimal string)
VAT_RATE_ZERO     = '0.00'

VAT_CATEGORY_CHOICES = {
    VAT_CATEGORY_STANDARD:  ('5%', VAT_RATE_STANDARD),
    VAT_CATEGORY_ZERO:      ('0%', VAT_RATE_ZERO),
    VAT_CATEGORY_EXEMPT:    ('Exempt', '0.00'),
    VAT_CATEGORY_OUT_SCOPE: ('Out of scope', '0.00'),
    VAT_CATEGORY_REVERSE:   ('Reverse charge', '0.00'),
}

# VAT exemption reason codes (UAE-specific)
VAT_EXEMPTION_REASONS = {
    'VATEX-UAE-R': 'Subject to VAT reverse charge',
    'VATEX-UAE-S': 'Financial services exempt from VAT',
    'VATEX-UAE-G': 'General exemption per Article 45',
    'VATEX-UAE-I': 'Insurance / reinsurance',
    'VATEX-UAE-E': 'Local supply of healthcare services',
    'VATEX-UAE-0': 'Export of goods',
    'VATEX-UAE-EX': 'Intra-GCC supplies',
}

# ─── Tax Scheme ───────────────────────────────────────────────────────────────

UAE_TAX_SCHEME_ID   = 'VAT'
UAE_TAX_SCHEME_NAME = 'Value Added Tax'

# ─── Currency ─────────────────────────────────────────────────────────────────

UAE_DEFAULT_CURRENCY = 'AED'

# ─── TRN Validation ───────────────────────────────────────────────────────────

TRN_LENGTH = 15           # UAE Tax Registration Number is always 15 digits
TRN_PREFIX = '1'          # UAE TRNs typically start with '1'

# ─── Mandatory Fields for PINT-AE ────────────────────────────────────────────

# All PINT-AE invoices MUST have these fields
MANDATORY_FIELDS = [
    'InvoiceTypeCode',           # 380, 381, 383, 389
    'IssueDate',                 # YYYY-MM-DD
    'DocumentCurrencyCode',      # ISO 4217 (AED)
    'BuyerReference',            # Buyer's purchase order reference or similar
    'AccountingSupplierParty',   # Seller information
    'AccountingCustomerParty',   # Buyer information
    'LegalMonetaryTotal',        # Invoice totals
    'InvoiceLine',               # At least one line item
    'TaxTotal',                  # VAT total
]

# Mandatory supplier fields
MANDATORY_SUPPLIER_FIELDS = [
    'PartyName',                 # Company name
    'PostalAddress',             # Physical address
    'PartyTaxScheme/CompanyID',  # TRN (Tax Registration Number)
    'PartyTaxScheme/TaxScheme',  # 'VAT'
    'PartyLegalEntity/RegistrationName',  # Legal registered name
]

# Mandatory buyer fields (for B2B invoices)
MANDATORY_BUYER_FIELDS = [
    'PartyName',                 # Company name
    'PostalAddress',             # Physical address
    'PartyLegalEntity/RegistrationName',  # Legal registered name
]

# ─── UAE UBL Namespace ────────────────────────────────────────────────────────

UBL_INVOICE_NS   = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
UBL_CREDIT_NS    = 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'
UBL_CAC_NS       = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
UBL_CBC_NS       = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
UBL_EXT_NS       = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'

UBL_NAMESPACES = {
    None:    UBL_INVOICE_NS,
    'cac':   UBL_CAC_NS,
    'cbc':   UBL_CBC_NS,
    'ext':   UBL_EXT_NS,
}

# ─── Schematron Rule IDs ──────────────────────────────────────────────────────

# Critical PINT-AE rules that must pass for UAE compliance
PINT_AE_CRITICAL_RULES = [
    'PINT-AE-R001',  # Seller TRN mandatory for B2B
    'PINT-AE-R002',  # Buyer TRN for B2B invoices above AED 10,000
    'PINT-AE-R003',  # Invoice date must be current or future (max 30 days back)
    'PINT-AE-R004',  # VAT amount matches calculated value
    'PINT-AE-R005',  # TRN format validation (15 digits)
    'PINT-AE-R006',  # Invoice type code must be supported
    'PINT-AE-R007',  # Credit note must reference original invoice
]
