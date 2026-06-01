"""
UAE VAT Audit File (FAF) Generator.

Generates a quarterly FAF extract per the UAE MoF e-invoicing specification.
The FAF must include all tax invoices and credit notes issued in a VAT period.

Format: CSV (default) — matches the FTA portal import format.

Columns (per FTA spec, Section 4.2):
  SellerTRN, SellerName, BuyerTRN, BuyerName, InvoiceNumber, InvoiceDate,
  InvoiceType, Currency, ExchangeRate, TaxableAmount, VATAmount, TotalAmount,
  VATCategory, SupplyDate, ReferencedInvoice (for credit notes)

Usage:
  result = FAFGenerator.generate(company, period_start, period_end, user=request.user)
  # result.file — Django FieldFile pointing to the generated CSV
  # result.invoice_count, result.total_vat_amount etc. for statistics
"""
import csv
import hashlib
import io
import logging
from datetime import date
from decimal import Decimal

from django.core.files.base import ContentFile
from django.utils import timezone

logger = logging.getLogger(__name__)


class FAFGenerator:
    """
    Generates the FTA Audit File (FAF) for a company and VAT period.

    The generator is stateless — call generate() as a classmethod.
    All database queries are executed within the method to keep it testable.
    """

    # CSV column headers per UAE FTA specification
    CSV_HEADERS = [
        'SellerTRN',
        'SellerName',
        'BuyerTRN',
        'BuyerName',
        'InvoiceNumber',
        'InvoiceDate',
        'SupplyDate',
        'InvoiceType',
        'InvoiceTypeCode',
        'Currency',
        'ExchangeRate',
        'TaxableAmountAED',
        'VATAmountAED',
        'TotalAmountAED',
        'VATCategory',
        'PurchaseOrderNumber',
        'ReferencedInvoice',
        'ASPSubmissionID',
        'FTAReference',
    ]

    @classmethod
    def generate(
        cls,
        company,
        period_start: date,
        period_end: date,
        user=None,
    ):
        """
        Generate a FAF for the specified company and VAT period.

        Queries all validated/paid invoices issued in [period_start, period_end].
        Saves the CSV file to Django media storage.
        Creates and returns a FATAuditFile record.

        Args:
            company:      Company instance
            period_start: First day of the VAT period (inclusive)
            period_end:   Last day of the VAT period (inclusive)
            user:         User who triggered generation (for audit)

        Returns:
            FATAuditFile instance with file attached and statistics populated.
        """
        from apps.invoices.models import Invoice
        from apps.reporting.models import FATAuditFile

        logger.info(
            'Generating FAF for company=%s period=%s to %s',
            company.name, period_start, period_end
        )

        # Fetch all relevant invoices
        invoices = (
            Invoice.objects
            .select_related('company', 'customer')
            .filter(
                company=company,
                status__in=['validated', 'paid'],
                issue_date__gte=period_start,
                issue_date__lte=period_end,
                is_active=True,
            )
            .order_by('issue_date', 'invoice_sequence')
        )

        # Build CSV in memory
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=cls.CSV_HEADERS, lineterminator='\n')
        writer.writeheader()

        invoice_count     = 0
        credit_note_count = 0
        total_taxable     = Decimal('0.00')
        total_vat         = Decimal('0.00')

        for inv in invoices:
            # Determine VAT category code for UBL
            vat_category = cls._get_primary_vat_category(inv)

            # PEPPOL invoice type code
            type_code_map = {
                'tax_invoice':        '380',
                'credit_note':        '381',
                'commercial_invoice': '480',
                'continuous_supply':  '380',
                'simplified':         '388',
            }
            type_code = type_code_map.get(inv.invoice_type, '380')

            writer.writerow({
                'SellerTRN':          company.trn,
                'SellerName':         company.legal_name or company.name,
                'BuyerTRN':           getattr(inv.customer, 'trn', '') or '',
                'BuyerName':          inv.customer.name,
                'InvoiceNumber':      inv.invoice_number,
                'InvoiceDate':        inv.issue_date.isoformat(),
                'SupplyDate':         inv.supply_date.isoformat() if inv.supply_date else '',
                'InvoiceType':        inv.get_invoice_type_display(),
                'InvoiceTypeCode':    type_code,
                'Currency':           inv.currency,
                'ExchangeRate':       str(inv.exchange_rate),
                'TaxableAmountAED':   str(inv.taxable_amount),
                'VATAmountAED':       str(inv.total_vat),
                'TotalAmountAED':     str(inv.total_amount),
                'VATCategory':        vat_category,
                'PurchaseOrderNumber': inv.purchase_order_number,
                'ReferencedInvoice':  inv.reference_number,
                'ASPSubmissionID':    inv.asp_submission_id,
                'FTAReference':       inv.fta_reference,
            })

            # Statistics
            if inv.invoice_type == 'credit_note':
                credit_note_count += 1
            else:
                invoice_count += 1

            total_taxable += inv.taxable_amount
            total_vat     += inv.total_vat

        csv_content = output.getvalue().encode('utf-8-sig')  # UTF-8 with BOM for Excel

        # Build filename
        filename = (
            f'FAF_{company.trn}_{period_start.strftime("%Y%m%d")}'
            f'_{period_end.strftime("%Y%m%d")}.csv'
        )

        # Create or update FATAuditFile record
        faf, _ = FATAuditFile.objects.get_or_create(
            company=company,
            period_start=period_start,
            period_end=period_end,
            defaults={'generated_by': user},
        )

        faf.file.save(filename, ContentFile(csv_content), save=False)
        faf.file_format         = 'csv'
        faf.status              = FATAuditFile.STATUS_GENERATED
        faf.generated_by        = user
        faf.invoice_count       = invoice_count
        faf.credit_note_count   = credit_note_count
        faf.total_taxable_amount = total_taxable
        faf.total_vat_amount    = total_vat
        faf.error_detail        = ''
        faf.save()

        logger.info(
            'FAF generated: %s invoices, %s credit notes, VAT total=%s AED',
            invoice_count, credit_note_count, total_vat
        )
        return faf

    @staticmethod
    def _get_primary_vat_category(invoice) -> str:
        """
        Return the dominant VAT category code for the invoice.
        Uses the category with the highest taxable amount.

        PEPPOL VAT category codes:
          S = Standard (5%)
          Z = Zero (0%)
          E = Exempt
          O = Outside scope
        """
        category_map = {
            'standard':    'S',
            'zero':        'Z',
            'exempt':      'E',
            'out_of_scope': 'O',
        }
        from decimal import Decimal
        totals: dict[str, Decimal] = {}
        for item in invoice.items.filter(is_active=True):
            k = item.vat_rate_type
            totals[k] = totals.get(k, Decimal('0.00')) + item.subtotal

        if not totals:
            return 'S'

        dominant = max(totals, key=lambda k: totals[k])
        return category_map.get(dominant, 'S')
