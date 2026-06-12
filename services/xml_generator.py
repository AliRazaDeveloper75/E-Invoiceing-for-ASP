"""
UAE PEPPOL-compliant XML Generator.

Generates UBL 2.1 Invoice XML as mandated by UAE MoF.
This step delivers a complete, working XML output.
Full PEPPOL BIS Billing 3.0 schema validation is added in Step 8.

References:
  - PEPPOL BIS Billing 3.0
  - UBL 2.1 (ISO/IEC 19845)
  - UAE MoF e-invoicing mandate (Phase 1 Q2 2026)
  - Federal Decree-Law No. 16 of 2024 (Articles 65, 70)
"""
import logging
from decimal import Decimal
from datetime import date
from lxml import etree

from apps.common.constants import (
    PEPPOL_UBL_VERSION,
    PEPPOL_CUSTOMIZATION_ID,
    PEPPOL_CUSTOMIZATION_ID_SELFBILL,
    PEPPOL_PROFILE_ID,
    UAE_COUNTRY_CODE,
    PROFILE_EXECUTION_IDS,
    INVOICE_TYPE_CREDIT_NOTE,
    INVOICE_TYPE_COMMERCIAL,
    INVOICE_TYPE_CONTINUOUS,
)

logger = logging.getLogger(__name__)

# ─── UBL 2.1 Namespace Map ────────────────────────────────────────────────────
# All namespaces required for a valid PEPPOL BIS 3.0 invoice
NS = {
    None:    'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    'cac':   'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'cbc':   'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'ext':   'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
}

# Credit Notes are a distinct UBL document (CreditNote-2), not an Invoice.
NS_CREDITNOTE = {**NS, None: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'}

CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'

# Default credit-note reason code (BTAE-03 / DiscrepancyResponse/ResponseCode).
# Required for credit notes (rule ibr-158-ae) and must come from the UAE
# "Reasons for credit note" code list (rule ibr-001-ae): one of
#   DL8.61.1.A / .B / .C / .D / .E  or  VD (void).
# We default to DL8.61.1.A (most common — adjustment of the taxable amount).
# 'VD' is avoided as it would forbid the preceding-invoice reference (ibr-055-ae).
CREDIT_NOTE_VALID_REASON_CODES = (
    'DL8.61.1.A', 'DL8.61.1.B', 'DL8.61.1.C', 'DL8.61.1.D', 'DL8.61.1.E', 'VD',
)
CREDIT_NOTE_DEFAULT_REASON_CODE = 'DL8.61.1.A'


def _cac(tag: str) -> str:
    return f'{{{CAC}}}{tag}'


def _cbc(tag: str) -> str:
    return f'{{{CBC}}}{tag}'


# ─── VAT Category Code Map ────────────────────────────────────────────────────
VAT_CATEGORY_CODE = {
    'standard':    'S',   # Standard rate
    'zero':        'Z',   # Zero rated
    'exempt':      'E',   # Exempt
    'out_of_scope': 'O',  # Out of scope
}

# ─── UN/ECE Unit Code Map (PEPPOL Rec 20) ─────────────────────────────────────
# Maps common human-readable unit strings → UN/ECE Rec 20 unit codes.
# 'C62' is the fallback (piece/unit — the most generic code).
_UNIT_CODE_MAP = {
    '':        'C62',
    'pcs':     'C62', 'pc':      'C62', 'piece':   'C62', 'pieces':  'C62',
    'unit':    'C62', 'units':   'C62', 'ea':      'C62', 'each':    'C62',
    'hr':      'HUR', 'hrs':     'HUR', 'hour':    'HUR', 'hours':   'HUR',
    'day':     'DAY', 'days':    'DAY',
    'month':   'MON', 'months':  'MON', 'mon':     'MON',
    'year':    'ANN', 'years':   'ANN', 'ann':     'ANN',
    'kg':      'KGM', 'kgs':     'KGM', 'kgm':     'KGM',
    'g':       'GRM', 'gm':      'GRM', 'gram':    'GRM', 'grams':   'GRM',
    'lb':      'LBR', 'lbs':     'LBR', 'pound':   'LBR',
    'm':       'MTR', 'mtr':     'MTR', 'meter':   'MTR', 'metre':   'MTR',
    'km':      'KMT', 'kmt':     'KMT',
    'cm':      'CMT', 'cmt':     'CMT',
    'l':       'LTR', 'ltr':     'LTR', 'litre':   'LTR', 'liter':   'LTR', 'lt': 'LTR',
    'ml':      'MLT', 'mlt':     'MLT',
    'm2':      'MTK', 'sqm':     'MTK', 'sq.m':    'MTK',
    'm3':      'MTQ', 'cbm':     'MTQ',
    'set':     'SET', 'sets':    'SET',
    'lot':     'LO',  'lots':    'LO',
    'box':     'BX',  'boxes':   'BX',
    'pack':    'PK',  'packs':   'PK', 'pkg':     'PK',
    'roll':    'RO',  'rolls':   'RO',
}


def _resolve_unit_code(unit: str) -> str:
    """Return a valid UN/ECE Rec 20 unit code from a human-readable unit string."""
    if not unit:
        return 'C62'
    lower = unit.lower().strip()
    if lower in _UNIT_CODE_MAP:
        return _UNIT_CODE_MAP[lower]
    # If the value is already a known 2–3-char uppercase code, pass it through
    upper = unit.upper().strip()
    if 2 <= len(upper) <= 3 and upper.isalpha():
        return upper
    return 'C62'


class UAEInvoiceXMLGenerator:
    """
    Generates PEPPOL UBL 2.1 XML bytes for a UAE e-invoice.

    Usage:
        generator = UAEInvoiceXMLGenerator()
        xml_bytes = generator.generate(invoice)

    Returns raw UTF-8 XML bytes. The caller (task) saves this to media storage
    and updates invoice.xml_file and invoice.xml_generated_at.
    """

    def generate(self, invoice) -> bytes:
        """
        Build and return the complete UBL 2.1 Invoice XML.
        """
        logger.info('Generating XML for invoice: %s', invoice.invoice_number)

        if invoice.invoice_type == INVOICE_TYPE_CREDIT_NOTE:
            root = etree.Element('CreditNote', nsmap=NS_CREDITNOTE)
        else:
            root = etree.Element('Invoice', nsmap=NS)

        self._add_header(root, invoice)
        self._add_accounting_supplier_party(root, invoice.company)
        self._add_accounting_customer_party(root, invoice.customer)
        self._add_payment_means(root, invoice)
        self._add_payment_terms(root, invoice)
        self._add_tax_total(root, invoice)
        self._add_legal_monetary_total(root, invoice)
        self._add_invoice_lines(root, invoice)

        xml_bytes = etree.tostring(
            root,
            pretty_print=True,
            xml_declaration=True,
            encoding='UTF-8',
        )

        logger.info(
            'XML generated for invoice %s (%d bytes)',
            invoice.invoice_number, len(xml_bytes)
        )
        return xml_bytes

    # ── Header ─────────────────────────────────────────────────────────────────

    def _add_header(self, root, invoice) -> None:
        """UBL header: version, customization, profile, ID, dates, type."""

        def cbc(tag, text, **attrs):
            el = etree.SubElement(root, _cbc(tag), **attrs)
            el.text = str(text) if text is not None else ''
            return el

        cbc('UBLVersionID', PEPPOL_UBL_VERSION)
        # UAE PINT-AE CustomizationID — self-billing uses a distinct profile.
        is_self_billed = getattr(invoice, 'is_self_billed', False)
        customization_id = (
            PEPPOL_CUSTOMIZATION_ID_SELFBILL if is_self_billed else PEPPOL_CUSTOMIZATION_ID
        )
        cbc('CustomizationID', customization_id)
        cbc('ProfileID', PEPPOL_PROFILE_ID)

        # ProfileExecutionID identifies the business process variant
        profile_exec_id = PROFILE_EXECUTION_IDS.get(invoice.invoice_type, '00000000')
        cbc('ProfileExecutionID', profile_exec_id)

        cbc('ID', invoice.invoice_number)

        # UUID — UAE unique identifier number (BTAE-07). Rule ibr-193-ae requires
        # cbc:UUID to be present. We use the invoice's stable DB id.
        cbc('UUID', str(invoice.id))

        cbc('IssueDate', _fmt_date(invoice.issue_date))

        # UBL CreditNote has no DueDate (no payment is due on a credit note).
        if invoice.due_date and invoice.invoice_type != INVOICE_TYPE_CREDIT_NOTE:
            cbc('DueDate', _fmt_date(invoice.due_date))

        # InvoiceTypeCode per UAE PEPPOL:
        #   380 — Tax Invoice / Continuous Supply
        #   381 — Credit Note
        #   480 — Commercial Invoice (non-VAT / outside scope)
        if invoice.invoice_type == INVOICE_TYPE_CREDIT_NOTE:
            type_code = '381'
        elif invoice.invoice_type == INVOICE_TYPE_COMMERCIAL:
            type_code = '480'
        else:
            type_code = '380'
        # CreditNote uses cbc:CreditNoteTypeCode; Invoice uses cbc:InvoiceTypeCode.
        type_tag = ('CreditNoteTypeCode'
                    if invoice.invoice_type == INVOICE_TYPE_CREDIT_NOTE
                    else 'InvoiceTypeCode')
        cbc(type_tag, type_code)

        if invoice.notes:
            cbc('Note', invoice.notes)

        # InvoicePeriod — required for continuous supply invoices
        if invoice.invoice_type == INVOICE_TYPE_CONTINUOUS and invoice.supply_date:
            period = etree.SubElement(root, _cac('InvoicePeriod'))
            start_el = etree.SubElement(period, _cbc('StartDate'))
            start_el.text = _fmt_date(invoice.supply_date)
            if invoice.supply_date_end:
                end_el = etree.SubElement(period, _cbc('EndDate'))
                end_el.text = _fmt_date(invoice.supply_date_end)

        # Tax point (supply) date — rule ibr-141-ae: when present it MUST be
        # strictly before the issue date. Only emit when that actually holds
        # (otherwise omit; TaxPointDate is optional).
        if invoice.supply_date and invoice.supply_date < invoice.issue_date:
            cbc('TaxPointDate', _fmt_date(invoice.supply_date))

        cbc('DocumentCurrencyCode', invoice.currency)
        # VAT accounting currency (ibt-006). Rule ibr-077: it MUST differ from the
        # document currency. UAE VAT is always accounted in AED, so we only emit
        # TaxCurrencyCode when the invoice is in a non-AED currency.
        if (invoice.currency or 'AED').upper() != 'AED':
            cbc('TaxCurrencyCode', 'AED')

        # Buyer reference (PO number if available)
        if invoice.purchase_order_number:
            cbc('BuyerReference', invoice.purchase_order_number)

        # ContractDocumentReference — for continuous supply contracts
        if invoice.invoice_type == INVOICE_TYPE_CONTINUOUS and invoice.contract_reference:
            contract_ref = etree.SubElement(root, _cac('ContractDocumentReference'))
            contract_id = etree.SubElement(contract_ref, _cbc('ID'))
            contract_id.text = invoice.contract_reference

        # Credit-note specifics (UBL order: DiscrepancyResponse then BillingReference)
        if invoice.invoice_type == INVOICE_TYPE_CREDIT_NOTE:
            # Credit note reason code (BTAE-03) — mandatory (rule ibr-158-ae).
            disc = etree.SubElement(root, _cac('DiscrepancyResponse'))
            resp_code = etree.SubElement(disc, _cbc('ResponseCode'))
            resp_code.text = getattr(invoice, 'credit_note_reason_code', '') or CREDIT_NOTE_DEFAULT_REASON_CODE
            reason_text = (invoice.notes or '').strip()
            if reason_text:
                desc = etree.SubElement(disc, _cbc('Description'))
                desc.text = reason_text[:200]

            # Preceding invoice reference (IBG-03) — mandatory for credit notes
            # unless the reason code is 'VD' (rule ibr-055-ae).
            if invoice.reference_number:
                billing_ref = etree.SubElement(root, _cac('BillingReference'))
                inv_doc_ref = etree.SubElement(billing_ref, _cac('InvoiceDocumentReference'))
                id_el = etree.SubElement(inv_doc_ref, _cbc('ID'))
                id_el.text = invoice.reference_number

    # ── Supplier Party ─────────────────────────────────────────────────────────

    def _add_accounting_supplier_party(self, root, company) -> None:
        """Corner 1: The issuing company (supplier/seller)."""
        party_root = etree.SubElement(root, _cac('AccountingSupplierParty'))
        party = etree.SubElement(party_root, _cac('Party'))

        # PEPPOL electronic address (ibt-034). UAE uses ISO 6523 scheme 0235 with
        # the 15-digit TRN as the participant value — this is also what the UAE
        # legal-registration rules key off (EndpointID/@schemeID = "0235").
        endpoint_value = company.peppol_endpoint or company.trn
        ep = etree.SubElement(party, _cbc('EndpointID'), schemeID='0235')
        ep.text = endpoint_value

        # Party identifier (TRN with UAE scheme 0235)
        party_id = etree.SubElement(party, _cac('PartyIdentification'))
        id_el = etree.SubElement(party_id, _cbc('ID'), schemeID='0235')
        id_el.text = endpoint_value

        # Party name
        party_name = etree.SubElement(party, _cac('PartyName'))
        name_el = etree.SubElement(party_name, _cbc('Name'))
        name_el.text = company.legal_name or company.name

        # Address — include the emirate as CountrySubentity (ibr-143-ae)
        _add_postal_address(party, company.street_address, company.city,
                            company.po_box, UAE_COUNTRY_CODE,
                            country_subentity=company.get_emirate_display() if company.emirate else '')

        # TRN (Tax Registration Number)
        _add_party_tax_scheme(party, company.trn, UAE_COUNTRY_CODE)

        # Legal entity — with optional legal registration ID (trade license etc.)
        _add_legal_entity(
            party,
            company.legal_name or company.name,
            registration_id=company.legal_registration_id or '',
            registration_scheme=company.legal_registration_type or '',
            registration_authority=getattr(company, 'legal_registration_authority', '') or '',
        )

    # ── Customer Party ─────────────────────────────────────────────────────────

    def _add_accounting_customer_party(self, root, customer) -> None:
        """Corner 4: The buyer (customer)."""
        party_root = etree.SubElement(root, _cac('AccountingCustomerParty'))
        party = etree.SubElement(party_root, _cac('Party'))

        # Buyer electronic address (ibt-049) — MANDATORY (rule ibr-080). UAE uses
        # ISO 6523 scheme 0235 with the buyer's TRN; fall back to any registered
        # Peppol endpoint or VAT number.
        buyer_endpoint = customer.peppol_endpoint or customer.trn or customer.vat_number
        if buyer_endpoint:
            ep = etree.SubElement(party, _cbc('EndpointID'), schemeID='0235')
            ep.text = buyer_endpoint

        # Party name
        party_name = etree.SubElement(party, _cac('PartyName'))
        name_el = etree.SubElement(party_name, _cbc('Name'))
        name_el.text = customer.legal_name or customer.name

        # Address — buyer country subdivision is mandatory (ibr-144-ae)
        _add_postal_address(
            party,
            customer.street_address,
            customer.city,
            '',
            customer.country,
            country_subentity=getattr(customer, 'state_province', '') or customer.city,
        )

        # TRN (UAE) or VAT number (international)
        tax_id = customer.trn or customer.vat_number
        if tax_id:
            _add_party_tax_scheme(party, tax_id, customer.country)

        _add_legal_entity(party, customer.legal_name or customer.name)

    # ── Payment Means ─────────────────────────────────────────────────────────

    def _add_payment_means(self, root, invoice) -> None:
        """
        PaymentMeans — mandatory PEPPOL BIS 3.0 element (UAE FTA field #9).
        PaymentMeansCode is a UN/ECE UNCL 4461 code (e.g. 30 = credit transfer).
        """
        pm = etree.SubElement(root, _cac('PaymentMeans'))
        code = invoice.payment_means_code or '30'
        code_el = etree.SubElement(pm, _cbc('PaymentMeansCode'))
        code_el.text = code
        if invoice.due_date:
            pay_due = etree.SubElement(pm, _cbc('PaymentDueDate'))
            pay_due.text = _fmt_date(invoice.due_date)

        # Payment account identifier (IBT-084). Rule ibr-192-ae: when the payment
        # means is credit transfer (code 30) the payee financial account ID MUST
        # be present. Use the company IBAN, else the bank account number.
        company = getattr(invoice, 'company', None)
        account_id = (getattr(company, 'iban', '') or
                      getattr(company, 'bank_account_number', '')) if company else ''
        if code == '30' and account_id:
            fin_acct = etree.SubElement(pm, _cac('PayeeFinancialAccount'))
            acct_id = etree.SubElement(fin_acct, _cbc('ID'))
            acct_id.text = account_id
            bank_name = getattr(company, 'bank_name', '') if company else ''
            if bank_name:
                branch = etree.SubElement(fin_acct, _cac('FinancialInstitutionBranch'))
                branch_id = etree.SubElement(branch, _cbc('ID'))
                branch_id.text = getattr(company, 'swift_code', '') or bank_name

    # ── Payment Terms ──────────────────────────────────────────────────────────

    def _add_payment_terms(self, root, invoice) -> None:
        if not invoice.due_date:
            return
        pt = etree.SubElement(root, _cac('PaymentTerms'))
        note = etree.SubElement(pt, _cbc('Note'))
        note.text = f'Payment due by {_fmt_date(invoice.due_date)}'

    # ── Tax Total ─────────────────────────────────────────────────────────────

    def _add_tax_total(self, root, invoice) -> None:
        """
        TaxTotal with TaxSubtotal per VAT category.
        Required by PEPPOL BIS 3.0: one TaxTotal element with subtotals per rate.
        """
        from apps.invoices.services import VATCalculationService

        tax_total = etree.SubElement(root, _cac('TaxTotal'))

        # Total VAT amount
        tax_amount = etree.SubElement(tax_total, _cbc('TaxAmount'),
                                      currencyID=invoice.currency)
        tax_amount.text = _fmt_amount(invoice.total_vat)

        # Per-rate subtotals (e.g. 5% standard, 0% zero-rated)
        vat_summary = VATCalculationService.get_vat_summary(invoice)

        for entry in vat_summary.values():
            subtotal = etree.SubElement(tax_total, _cac('TaxSubtotal'))

            taxable_el = etree.SubElement(subtotal, _cbc('TaxableAmount'),
                                          currencyID=invoice.currency)
            taxable_el.text = _fmt_amount(entry['taxable_amount'])

            vat_el = etree.SubElement(subtotal, _cbc('TaxAmount'),
                                      currencyID=invoice.currency)
            vat_el.text = _fmt_amount(entry['vat_amount'])

            tax_cat = etree.SubElement(subtotal, _cac('TaxCategory'))
            cat_id = etree.SubElement(tax_cat, _cbc('ID'))
            cat_id.text = VAT_CATEGORY_CODE.get(entry['vat_rate_type'], 'S')

            pct = etree.SubElement(tax_cat, _cbc('Percent'))
            pct.text = _fmt_amount(entry['vat_rate'])

            scheme = etree.SubElement(tax_cat, _cac('TaxScheme'))
            scheme_id = etree.SubElement(scheme, _cbc('ID'))
            scheme_id.text = 'VAT'

    # ── Legal Monetary Total ───────────────────────────────────────────────────

    def _add_legal_monetary_total(self, root, invoice) -> None:
        """Invoice financial summary — required PEPPOL element."""
        lmt = etree.SubElement(root, _cac('LegalMonetaryTotal'))

        def amt(tag, value):
            el = etree.SubElement(lmt, _cbc(tag), currencyID=invoice.currency)
            el.text = _fmt_amount(value)

        amt('LineExtensionAmount', invoice.subtotal)        # Sum of line amounts
        amt('TaxExclusiveAmount',  invoice.taxable_amount)  # After discount, before VAT
        amt('TaxInclusiveAmount',  invoice.total_amount)    # Grand total incl. VAT
        amt('AllowanceTotalAmount', invoice.discount_amount)
        amt('PayableAmount',        invoice.total_amount)

    # ── Invoice Lines ──────────────────────────────────────────────────────────

    def _add_invoice_lines(self, root, invoice) -> None:
        """One InvoiceLine (or CreditNoteLine) element per active item."""
        is_credit = invoice.invoice_type == INVOICE_TYPE_CREDIT_NOTE
        line_tag = 'CreditNoteLine' if is_credit else 'InvoiceLine'
        qty_tag  = 'CreditedQuantity' if is_credit else 'InvoicedQuantity'
        for item in invoice.items.filter(is_active=True).order_by('sort_order'):
            line = etree.SubElement(root, _cac(line_tag))

            id_el = etree.SubElement(line, _cbc('ID'))
            id_el.text = str(item.sort_order + 1)

            unit_code = _resolve_unit_code(item.unit)
            qty = etree.SubElement(line, _cbc(qty_tag), unitCode=unit_code)
            qty.text = str(item.quantity.normalize())

            line_ext = etree.SubElement(line, _cbc('LineExtensionAmount'),
                                        currencyID=invoice.currency)
            line_ext.text = _fmt_amount(item.subtotal)

            # Item tax info
            line_tax_total = etree.SubElement(line, _cac('TaxTotal'))
            line_tax_amt = etree.SubElement(line_tax_total, _cbc('TaxAmount'),
                                            currencyID=invoice.currency)
            line_tax_amt.text = _fmt_amount(item.vat_amount)

            # Item description and name
            item_el = etree.SubElement(line, _cac('Item'))
            desc = etree.SubElement(item_el, _cbc('Description'))
            desc.text = item.description

            # Name: use dedicated item_name if set, else fall back to first 80 chars of description
            name_el = etree.SubElement(item_el, _cbc('Name'))
            name_el.text = (item.item_name.strip() or item.description[:80]) if item.item_name else item.description[:80]

            # VAT category for this line
            classified_tax = etree.SubElement(item_el, _cac('ClassifiedTaxCategory'))
            cat_id = etree.SubElement(classified_tax, _cbc('ID'))
            cat_id.text = VAT_CATEGORY_CODE.get(item.vat_rate_type, 'S')
            pct = etree.SubElement(classified_tax, _cbc('Percent'))
            pct.text = _fmt_amount(item.vat_rate)
            scheme = etree.SubElement(classified_tax, _cac('TaxScheme'))
            scheme_id = etree.SubElement(scheme, _cbc('ID'))
            scheme_id.text = 'VAT'

            # Unit price (net). Rule ibr-126-ae requires both the price base
            # quantity (IBT-149) and a gross price (IBT-148, via Price/
            # AllowanceCharge/BaseAmount).
            price = etree.SubElement(line, _cac('Price'))
            price_amt = etree.SubElement(price, _cbc('PriceAmount'),
                                         currencyID=invoice.currency)
            price_amt.text = _fmt_amount(item.unit_price)

            base_qty = etree.SubElement(price, _cbc('BaseQuantity'), unitCode=unit_code)
            base_qty.text = '1'

            # Gross price = net price here (no per-unit price discount).
            price_ac = etree.SubElement(price, _cac('AllowanceCharge'))
            ci = etree.SubElement(price_ac, _cbc('ChargeIndicator'))
            ci.text = 'false'
            ac_amt = etree.SubElement(price_ac, _cbc('Amount'), currencyID=invoice.currency)
            ac_amt.text = '0.00'
            ac_base = etree.SubElement(price_ac, _cbc('BaseAmount'), currencyID=invoice.currency)
            ac_base.text = _fmt_amount(item.unit_price)

            # UAE AED line amounts: line net in AED (BTAE-10) + VAT in AED (BTAE-08).
            # Rules ibr-104-ae / ibr-194-ae. For AED invoices these equal the line
            # amounts; otherwise convert using the invoice exchange rate.
            rate = Decimal(str(invoice.exchange_rate or '1'))
            aed_amount = (Decimal(str(item.subtotal)) * rate).quantize(Decimal('0.01'))
            aed_vat = (Decimal(str(item.vat_amount)) * rate).quantize(Decimal('0.01'))
            ipe = etree.SubElement(line, _cac('ItemPriceExtension'))
            ipe_amt = etree.SubElement(ipe, _cbc('Amount'), currencyID='AED')
            ipe_amt.text = _fmt_amount(aed_amount)
            ipe_tax = etree.SubElement(ipe, _cac('TaxTotal'))
            ipe_tax_amt = etree.SubElement(ipe_tax, _cbc('TaxAmount'), currencyID='AED')
            ipe_tax_amt.text = _fmt_amount(aed_vat)


# ─── XML Helpers ──────────────────────────────────────────────────────────────

def _fmt_date(d) -> str:
    """Format a date to YYYY-MM-DD."""
    if isinstance(d, date):
        return d.strftime('%Y-%m-%d')
    return str(d)


def _fmt_amount(value) -> str:
    """Format a Decimal to 2 decimal places for XML."""
    if value is None:
        return '0.00'
    return f'{Decimal(str(value)):.2f}'


def _add_postal_address(party, street: str, city: str, po_box: str, country: str,
                        country_subentity: str = '') -> None:
    """
    UBL PostalAddress. UAE PINT rules ibr-143-ae / ibr-144-ae require, for both
    seller and buyer, that address line 1 (StreetName), city (CityName) and the
    country subdivision (CountrySubentity, e.g. the emirate) are all present.
    Order matters in UBL: StreetName, AdditionalStreetName, CityName,
    PostalZone, CountrySubentity, Country.
    """
    addr = etree.SubElement(party, _cac('PostalAddress'))
    if street:
        el = etree.SubElement(addr, _cbc('StreetName'))
        el.text = street
    if po_box:
        el = etree.SubElement(addr, _cbc('AdditionalStreetName'))
        el.text = f'P.O. Box {po_box}'
    if city:
        el = etree.SubElement(addr, _cbc('CityName'))
        el.text = city
    if country_subentity:
        el = etree.SubElement(addr, _cbc('CountrySubentity'))
        el.text = country_subentity
    country_el = etree.SubElement(addr, _cac('Country'))
    code_el = etree.SubElement(country_el, _cbc('IdentificationCode'))
    code_el.text = country or 'AE'


def _add_party_tax_scheme(party, tax_id: str, country: str) -> None:
    tax_scheme_el = etree.SubElement(party, _cac('PartyTaxScheme'))
    reg_name = etree.SubElement(tax_scheme_el, _cbc('RegistrationName'))
    reg_name.text = tax_id
    company_id = etree.SubElement(tax_scheme_el, _cbc('CompanyID'))
    company_id.text = tax_id
    scheme = etree.SubElement(tax_scheme_el, _cac('TaxScheme'))
    scheme_id = etree.SubElement(scheme, _cbc('ID'))
    scheme_id.text = 'VAT'


# UAE legal-registration type (BTAE-15). Rule ibr-173-ae only accepts the
# schemeAgencyID values TL / EID / PAS / CD on PartyLegalEntity/CompanyID when
# the seller is in AE with scheme 0235. Map our stored codes onto that set.
_LEGAL_REG_AGENCY_MAP = {
    'TL': 'TL', 'EID': 'EID', 'PAS': 'PAS', 'CD': 'CD',
    'CRN': 'TL',           # Commercial Registration Number → treated as Trade License
}


def _add_legal_entity(party, name: str, registration_id: str = '', registration_scheme: str = '',
                      registration_authority: str = '') -> None:
    """
    PartyLegalEntity. When a legal registration identifier (IBT-030, e.g. trade
    licence number) is provided we emit it with:
      * schemeID="0235"             → ISO 6523 ICD (rule ibr-cl-11)
      * schemeAgencyID="TL|EID|…"   → registration type BTAE-15 (rules ibr-173/181-ae)
      * schemeAgencyName="<auth>"   → issuing authority BTAE-12, required when
                                      type is Trade License (rule ibr-172-ae)
    If no registration id is available we omit CompanyID entirely (it is optional),
    which keeps the document valid.
    """
    legal = etree.SubElement(party, _cac('PartyLegalEntity'))
    reg_name = etree.SubElement(legal, _cbc('RegistrationName'))
    reg_name.text = name
    if registration_id:
        agency = _LEGAL_REG_AGENCY_MAP.get((registration_scheme or '').upper(), 'TL')
        attrs = {'schemeID': '0235', 'schemeAgencyID': agency}
        # BTAE-12: Trade-License registrations MUST carry the issuing authority name.
        if agency == 'TL':
            attrs['schemeAgencyName'] = registration_authority or 'Department of Economic Development'
        company_id = etree.SubElement(legal, _cbc('CompanyID'), **attrs)
        company_id.text = registration_id
