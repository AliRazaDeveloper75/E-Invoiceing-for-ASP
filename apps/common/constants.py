"""
System-wide constants for UAE E-Invoicing platform.
Based on: UAE MoF PEPPOL e-invoicing framework (Phase 1 go-live Q2 2026).
"""
from decimal import Decimal

# ─── UAE VAT Rates ────────────────────────────────────────────────────────────
VAT_STANDARD_RATE = 5       # 5% — standard UAE VAT
VAT_ZERO_RATE = 0           # 0% — eligible exports / zero-rated supplies
VAT_EXEMPT = None           # Exempt from VAT (financial services, residential rent, etc.)
UAE_VAT_RATE = Decimal('0.05')   # Decimal form used in calculations

VAT_RATE_CHOICES = [
    ('standard', 'Standard Rate (5%)'),
    ('zero', 'Zero Rate (0%)'),
    ('exempt', 'Exempt'),
    ('out_of_scope', 'Out of Scope'),
]

# ─── User Roles ───────────────────────────────────────────────────────────────
ROLE_ADMIN            = 'admin'            # Platform admin — manages users, inbound, ASP, FTA
ROLE_SUPPLIER         = 'supplier'         # Supplier — creates & submits own outbound invoices
ROLE_ACCOUNTANT       = 'accountant'       # Accountant — create/edit invoices (legacy, same as supplier)
ROLE_VIEWER           = 'viewer'           # Read-only access
ROLE_INBOUND_SUPPLIER = 'inbound_supplier' # External supplier — submits inbound invoices, sees own portal

USER_ROLE_CHOICES = [
    (ROLE_ADMIN,            'Admin'),
    (ROLE_SUPPLIER,         'Supplier'),
    (ROLE_ACCOUNTANT,       'Accountant'),
    (ROLE_VIEWER,           'Viewer'),
    (ROLE_INBOUND_SUPPLIER, 'Inbound Supplier'),
]

# ─── Invoice Status ───────────────────────────────────────────────────────────
# Internal lifecycle status
INVOICE_STATUS_DRAFT = 'draft'
INVOICE_STATUS_PENDING = 'pending'          # Queued for ASP submission
INVOICE_STATUS_SUBMITTED = 'submitted'      # Sent to ASP
INVOICE_STATUS_VALIDATED = 'validated'      # ASP accepted & validated
INVOICE_STATUS_REJECTED = 'rejected'        # ASP rejected
INVOICE_STATUS_CANCELLED = 'cancelled'      # Cancelled by user
INVOICE_STATUS_PAID = 'paid'

INVOICE_STATUS_CHOICES = [
    (INVOICE_STATUS_DRAFT,     'Draft'),
    (INVOICE_STATUS_PENDING,   'Pending Submission'),
    (INVOICE_STATUS_SUBMITTED, 'Submitted to ASP'),
    (INVOICE_STATUS_VALIDATED, 'Validated by ASP'),
    (INVOICE_STATUS_REJECTED,  'Rejected'),
    (INVOICE_STATUS_CANCELLED, 'Cancelled'),
    (INVOICE_STATUS_PAID,      'Paid'),
]

# ─── Invoice Types (per UAE VAT law + PEPPOL PINT AE) ────────────────────────
INVOICE_TYPE_TAX         = 'tax_invoice'        # Standard B2B/B2G (TypeCode 380)
INVOICE_TYPE_SIMPLIFIED  = 'simplified'         # B2C simplified (future)
INVOICE_TYPE_CREDIT_NOTE = 'credit_note'        # Per Article 65 amendment (TypeCode 381)
INVOICE_TYPE_COMMERCIAL  = 'commercial_invoice' # Commercial Invoice (TypeCode 480, non-VAT)
INVOICE_TYPE_CONTINUOUS  = 'continuous_supply'  # Continuous Supplies (TypeCode 380 + period)

INVOICE_TYPE_CHOICES = [
    (INVOICE_TYPE_TAX,        'Tax Invoice'),
    (INVOICE_TYPE_CREDIT_NOTE,'Credit Note'),
    (INVOICE_TYPE_COMMERCIAL, 'Commercial Invoice'),
    (INVOICE_TYPE_CONTINUOUS, 'Continuous Supply'),
    (INVOICE_TYPE_SIMPLIFIED, 'Simplified Invoice'),
]

# PEPPOL ProfileExecutionID mapping per type
PROFILE_EXECUTION_IDS = {
    INVOICE_TYPE_TAX:        '00000000',
    INVOICE_TYPE_CREDIT_NOTE:'00000000',
    INVOICE_TYPE_COMMERCIAL: '00000000',
    INVOICE_TYPE_CONTINUOUS: '00001000',
    INVOICE_TYPE_SIMPLIFIED: '00000000',
}

# ─── Transaction Types (per UAE e-invoicing scope) ───────────────────────────
TRANSACTION_B2B = 'b2b'     # Business-to-Business (Phase 1 mandatory)
TRANSACTION_B2G = 'b2g'     # Business-to-Government (Phase 1 mandatory)
TRANSACTION_B2C = 'b2c'     # Business-to-Consumer (Phase 2, future)

TRANSACTION_TYPE_CHOICES = [
    (TRANSACTION_B2B, 'B2B'),
    (TRANSACTION_B2G, 'B2G'),
    (TRANSACTION_B2C, 'B2C'),
]

# ─── ASP Transmission Status ─────────────────────────────────────────────────
ASP_STATUS_PENDING = 'pending'
ASP_STATUS_ACCEPTED = 'accepted'
ASP_STATUS_REJECTED = 'rejected'
ASP_STATUS_ERROR = 'error'

ASP_STATUS_CHOICES = [
    (ASP_STATUS_PENDING,  'Pending'),
    (ASP_STATUS_ACCEPTED, 'Accepted'),
    (ASP_STATUS_REJECTED, 'Rejected'),
    (ASP_STATUS_ERROR,    'Error'),
]

# ─── Currency ─────────────────────────────────────────────────────────────────
CURRENCY_AED = 'AED'    # UAE Dirham (default)
CURRENCY_USD = 'USD'
CURRENCY_EUR = 'EUR'

CURRENCY_CHOICES = [
    (CURRENCY_AED, 'UAE Dirham (AED)'),
    (CURRENCY_USD, 'US Dollar (USD)'),
    (CURRENCY_EUR, 'Euro (EUR)'),
]

DEFAULT_CURRENCY = CURRENCY_AED

# ─── PEPPOL / XML ─────────────────────────────────────────────────────────────
PEPPOL_UBL_VERSION = '2.1'
PEPPOL_CUSTOMIZATION_ID = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0'
PEPPOL_PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'
UAE_COUNTRY_CODE = 'AE'

# ─── FTA Reporting Status (Corner 5) ────────────────────────────────────────
FTA_STATUS_PENDING  = 'pending'
FTA_STATUS_REPORTED = 'reported'
FTA_STATUS_ERROR    = 'error'

FTA_STATUS_CHOICES = [
    (FTA_STATUS_PENDING,  'Pending Reporting'),
    (FTA_STATUS_REPORTED, 'Reported to FTA'),
    (FTA_STATUS_ERROR,    'Reporting Error'),
]

# ─── Payment Means (PEPPOL BIS 3.0 / UN/ECE UNCL 4461) ───────────────────────
PAYMENT_MEANS_CASH            = '10'
PAYMENT_MEANS_CHEQUE          = '20'
PAYMENT_MEANS_CREDIT_TRANSFER = '30'
PAYMENT_MEANS_BANK_CARD       = '48'
PAYMENT_MEANS_DIRECT_DEBIT    = '49'
PAYMENT_MEANS_STANDING_ORDER  = '57'
PAYMENT_MEANS_SEPA_TRANSFER   = '58'

PAYMENT_MEANS_CHOICES = [
    (PAYMENT_MEANS_CASH,            'Cash (10)'),
    (PAYMENT_MEANS_CHEQUE,          'Cheque (20)'),
    (PAYMENT_MEANS_CREDIT_TRANSFER, 'Credit Transfer (30)'),
    (PAYMENT_MEANS_BANK_CARD,       'Bank Card (48)'),
    (PAYMENT_MEANS_DIRECT_DEBIT,    'Direct Debit (49)'),
    (PAYMENT_MEANS_STANDING_ORDER,  'Standing Order (57)'),
    (PAYMENT_MEANS_SEPA_TRANSFER,   'SEPA Credit Transfer (58)'),
]

# ─── Legal Registration Type (UAE — trade license / Emirates ID / etc.) ───────
LEGAL_REG_TL  = 'TL'    # Trade License
LEGAL_REG_CRN = 'CRN'   # Commercial Registration Number
LEGAL_REG_EID = 'EID'   # Emirates ID
LEGAL_REG_PAS = 'PAS'   # Passport
LEGAL_REG_CD  = 'CD'    # Commercial Document

LEGAL_REG_TYPE_CHOICES = [
    (LEGAL_REG_TL,  'Trade License (TL)'),
    (LEGAL_REG_CRN, 'Commercial Registration Number (CRN)'),
    (LEGAL_REG_EID, 'Emirates ID (EID)'),
    (LEGAL_REG_PAS, 'Passport (PAS)'),
    (LEGAL_REG_CD,  'Commercial Document (CD)'),
]

# ─── Pagination ───────────────────────────────────────────────────────────────
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# ─── TRN Validation ───────────────────────────────────────────────────────────
# UAE TRN = 15 digits; TIN = first 10 digits (business identifier for B2B)
TRN_LENGTH = 15
TIN_LENGTH = 10
