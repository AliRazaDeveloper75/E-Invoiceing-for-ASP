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

CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'


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

        root = etree.Element('Invoice', nsmap=NS)

        self._add_header(root, invoice)
        self._add_accounting_supplier_party(root, invoice.company)
        self._add_accounting_customer_party(root, invoice.customer)
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
        cbc('CustomizationID', PEPPOL_CUSTOMIZATION_ID)
        cbc('ProfileID', PEPPOL_PROFILE_ID)

        # ProfileExecutionID identifies the business process variant
        profile_exec_id = PROFILE_EXECUTION_IDS.get(invoice.invoice_type, '00000000')
        cbc('ProfileExecutionID', profile_exec_id)

        cbc('ID', invoice.invoice_number)
        cbc('IssueDate', _fmt_date(invoice.issue_date))

        if invoice.due_date:
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
        cbc('InvoiceTypeCode', type_code)

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

        # Tax point (supply) date
        supply_date = invoice.supply_date or invoice.issue_date
        cbc('TaxPointDate', _fmt_date(supply_date))

        cbc('DocumentCurrencyCode', invoice.currency)
        cbc('TaxCurrencyCode', 'AED')    # VAT always reported in AED

        # Buyer reference (PO number if available)
        if invoice.purchase_order_number:
            cbc('BuyerReference', invoice.purchase_order_number)

        # ContractDocumentReference — for continuous supply contracts
        if invoice.invoice_type == INVOICE_TYPE_CONTINUOUS and invoice.contract_reference:
            contract_ref = etree.SubElement(root, _cac('ContractDocumentReference'))
            contract_id = etree.SubElement(contract_ref, _cbc('ID'))
            contract_id.text = invoice.contract_reference

        # Reference to original invoice for credit notes
        if invoice.invoice_type == INVOICE_TYPE_CREDIT_NOTE and invoice.reference_number:
            billing_ref = etree.SubElement(root, _cac('BillingReference'))
            inv_doc_ref = etree.SubElement(billing_ref, _cac('InvoiceDocumentReference'))
            id_el = etree.SubElement(inv_doc_ref, _cbc('ID'))
            id_el.text = invoice.reference_number

    # ── Supplier Party ─────────────────────────────────────────────────────────

    def _add_accounting_supplier_party(self, root, company) -> None:
        """Corner 1: The issuing company (supplier/seller)."""
        party_root = etree.SubElement(root, _cac('AccountingSupplierParty'))
        party = etree.SubElement(party_root, _cac('Party'))

        # PEPPOL endpoint (if registered)
        if company.peppol_endpoint:
            ep = etree.SubElement(party, _cbc('EndpointID'), schemeID='0088')
            ep.text = company.peppol_endpoint

        # Party name
        party_name = etree.SubElement(party, _cac('PartyName'))
        name_el = etree.SubElement(party_name, _cbc('Name'))
        name_el.text = company.legal_name or company.name

        # Address
        _add_postal_address(party, company.street_address, company.city,
                            company.po_box, UAE_COUNTRY_CODE)

        # TRN (Tax Registration Number)
        _add_party_tax_scheme(party, company.trn, UAE_COUNTRY_CODE)

        # Legal entity
        _add_legal_entity(party, company.legal_name or company.name)

    # ── Customer Party ─────────────────────────────────────────────────────────

    def _add_accounting_customer_party(self, root, customer) -> None:
        """Corner 4: The buyer (customer)."""
        party_root = etree.SubElement(root, _cac('AccountingCustomerParty'))
        party = etree.SubElement(party_root, _cac('Party'))

        # PEPPOL endpoint (if buyer is on the PEPPOL network)
        if customer.peppol_endpoint:
            ep = etree.SubElement(party, _cbc('EndpointID'), schemeID='0088')
            ep.text = customer.peppol_endpoint

        # Party name
        party_name = etree.SubElement(party, _cac('PartyName'))
        name_el = etree.SubElement(party_name, _cbc('Name'))
        name_el.text = customer.legal_name or customer.name

        # Address
        _add_postal_address(
            party,
            customer.street_address,
            customer.city,
            '',
            customer.country,
        )

        # TRN (UAE) or VAT number (international)
        tax_id = customer.trn or customer.vat_number
        if tax_id:
            _add_party_tax_scheme(party, tax_id, customer.country)

        _add_legal_entity(party, customer.legal_name or customer.name)

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
        """One InvoiceLine element per active item."""
        for item in invoice.items.filter(is_active=True).order_by('sort_order'):
            line = etree.SubElement(root, _cac('InvoiceLine'))

            id_el = etree.SubElement(line, _cbc('ID'))
            id_el.text = str(item.sort_order + 1)

            qty = etree.SubElement(line, _cbc('InvoicedQuantity'), unitCode='C62')
            qty.text = str(item.quantity.normalize())

            line_ext = etree.SubElement(line, _cbc('LineExtensionAmount'),
                                        currencyID=invoice.currency)
            line_ext.text = _fmt_amount(item.subtotal)

            # Item tax info
            line_tax_total = etree.SubElement(line, _cac('TaxTotal'))
            line_tax_amt = etree.SubElement(line_tax_total, _cbc('TaxAmount'),
                                            currencyID=invoice.currency)
            line_tax_amt.text = _fmt_amount(item.vat_amount)

            # Item description
            item_el = etree.SubElement(line, _cac('Item'))
            desc = etree.SubElement(item_el, _cbc('Description'))
            desc.text = item.description

            name_el = etree.SubElement(item_el, _cbc('Name'))
            name_el.text = item.description[:80]

            # VAT category for this line
            classified_tax = etree.SubElement(item_el, _cac('ClassifiedTaxCategory'))
            cat_id = etree.SubElement(classified_tax, _cbc('ID'))
            cat_id.text = VAT_CATEGORY_CODE.get(item.vat_rate_type, 'S')
            pct = etree.SubElement(classified_tax, _cbc('Percent'))
            pct.text = _fmt_amount(item.vat_rate)
            scheme = etree.SubElement(classified_tax, _cac('TaxScheme'))
            scheme_id = etree.SubElement(scheme, _cbc('ID'))
            scheme_id.text = 'VAT'

            # Unit price
            price = etree.SubElement(line, _cac('Price'))
            price_amt = etree.SubElement(price, _cbc('PriceAmount'),
                                         currencyID=invoice.currency)
            price_amt.text = _fmt_amount(item.unit_price)


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


def _add_postal_address(party, street: str, city: str, po_box: str, country: str) -> None:
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


def _add_legal_entity(party, name: str) -> None:
    legal = etree.SubElement(party, _cac('PartyLegalEntity'))
    reg_name = etree.SubElement(legal, _cbc('RegistrationName'))
    reg_name.text = name
