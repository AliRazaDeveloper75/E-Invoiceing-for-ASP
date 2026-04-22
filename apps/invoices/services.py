"""
Invoice service layer — the heart of the e-invoicing system.

Three service classes:
  VATCalculationService  — UAE 5% VAT rules, line-item and invoice totals
  InvoiceItemService     — add / update / remove invoice line items
  InvoiceService         — create, update, submit, cancel, lifecycle management

All business logic lives here. Views are thin controllers.
"""
import logging
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound

from apps.companies.models import Company, CompanyMember
from apps.customers.models import Customer
from .models import Invoice, InvoiceItem, VAT_RATE_MAP

logger = logging.getLogger(__name__)

TWO_PLACES = Decimal('0.01')


# ─── VAT Calculation Service ──────────────────────────────────────────────────

class VATCalculationService:
    """
    UAE VAT calculation engine.

    Standard rate: 5% (Federal Decree-Law No. 8 of 2017)
    Zero rate:     0% (exports, healthcare, education, etc.)
    Exempt:        no VAT charged, no input tax recovery
    Out of scope:  not within UAE VAT law

    All rounding: ROUND_HALF_UP to 2 decimal places (AED standard).
    """

    @staticmethod
    def calculate_item(
        quantity: Decimal,
        unit_price: Decimal,
        vat_rate_type: str,
    ) -> dict:
        """
        Calculate financial values for a single line item.

        Returns:
          subtotal    — quantity × unit_price
          vat_rate    — percentage (e.g. 5.00)
          vat_amount  — VAT charged on this line
          total_amount — subtotal + vat_amount
        """
        qty = Decimal(str(quantity))
        price = Decimal(str(unit_price))

        subtotal = (qty * price).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        rate = VAT_RATE_MAP.get(vat_rate_type)
        if rate is not None:
            vat_amount = (subtotal * rate / 100).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        else:
            rate = Decimal('0.00')
            vat_amount = Decimal('0.00')

        return {
            'subtotal':     subtotal,
            'vat_rate':     rate,
            'vat_amount':   vat_amount,
            'total_amount': (subtotal + vat_amount).quantize(TWO_PLACES, rounding=ROUND_HALF_UP),
        }

    @staticmethod
    def recalculate_invoice_totals(invoice: Invoice) -> Invoice:
        """
        Recompute invoice-level totals from all active line items.
        Called after any item is added, updated, or removed.

        Formula:
          subtotal      = Σ item.subtotal
          taxable_amount = subtotal − discount_amount
          total_vat     = Σ item.vat_amount  (on taxable items)
          total_amount  = taxable_amount + total_vat
        """
        items = invoice.items.filter(is_active=True)

        subtotal    = sum((i.subtotal    for i in items), Decimal('0.00'))
        total_vat   = sum((i.vat_amount  for i in items), Decimal('0.00'))

        subtotal        = subtotal.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        discount        = invoice.discount_amount or Decimal('0.00')
        taxable_amount  = (subtotal - discount).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        total_vat       = total_vat.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        total_amount    = (taxable_amount + total_vat).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        invoice.subtotal        = subtotal
        invoice.taxable_amount  = taxable_amount
        invoice.total_vat       = total_vat
        invoice.total_amount    = total_amount

        invoice.save(update_fields=[
            'subtotal', 'taxable_amount', 'total_vat', 'total_amount', 'updated_at'
        ])
        return invoice

    @staticmethod
    def get_vat_summary(invoice: Invoice) -> dict:
        """
        Break down VAT by rate type — needed for XML generation and reporting.

        Returns a dict keyed by vat_rate_type:
        {
          'standard': {'taxable_amount': ..., 'vat_amount': ..., 'vat_rate': 5.00},
          'zero':     {'taxable_amount': ..., 'vat_amount': ..., 'vat_rate': 0.00},
          ...
        }
        """
        summary = {}
        for item in invoice.items.filter(is_active=True):
            key = item.vat_rate_type
            if key not in summary:
                summary[key] = {
                    'vat_rate_type':  key,
                    'vat_rate':       item.vat_rate,
                    'taxable_amount': Decimal('0.00'),
                    'vat_amount':     Decimal('0.00'),
                }
            summary[key]['taxable_amount'] += item.subtotal
            summary[key]['vat_amount']     += item.vat_amount

        # Round all values
        for entry in summary.values():
            entry['taxable_amount'] = entry['taxable_amount'].quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
            entry['vat_amount']     = entry['vat_amount'].quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        return summary


# ─── Invoice Number Generator ─────────────────────────────────────────────────

class InvoiceNumberService:
    """Generates sequential, unique invoice numbers per company."""

    @staticmethod
    @transaction.atomic
    def generate(company: Company) -> tuple[str, int]:
        """
        Thread-safe invoice number generation using SELECT FOR UPDATE.

        Format: INV-{YYYYMM}-{sequence:06d}
        Example: INV-202601-000001

        Sequence is GLOBAL across all companies because invoice_number has a
        global unique constraint. Locking on the company row prevents races
        between concurrent requests for the same company.

        Returns: (invoice_number: str, sequence: int)
        """
        from django.db.models import Max

        # Lock ALL invoices (global) to prevent duplicate number generation
        # across companies that share the same unique invoice_number constraint.
        result = (
            Invoice.objects
            .select_for_update()
            .aggregate(max_seq=Max('invoice_sequence'))
        )
        next_seq = (result['max_seq'] or 0) + 1
        year_month = timezone.now().strftime('%Y%m')
        invoice_number = f'INV-{year_month}-{next_seq:06d}'
        return invoice_number, next_seq


# ─── Invoice Item Service ─────────────────────────────────────────────────────

class InvoiceItemService:
    """Manages line items on an invoice."""

    @staticmethod
    def add_item(invoice: Invoice, membership: CompanyMember, data: dict) -> InvoiceItem:
        """
        Add a line item to an invoice.
        Invoice must be in DRAFT status.
        Only Admin and Accountant can add items.
        """
        if not invoice.is_editable:
            raise ValidationError({
                'status': f'Cannot add items to an invoice with status "{invoice.status}". '
                          f'Only DRAFT invoices are editable.'
            })

        if membership.role not in ('admin', 'accountant'):
            raise PermissionDenied('Admin or Accountant role required to add invoice items.')

        # Determine next sort_order
        max_order = invoice.items.filter(is_active=True).count()

        item = InvoiceItem(
            invoice=invoice,
            item_name=data.get('item_name', '').strip(),
            description=data['description'].strip(),
            quantity=Decimal(str(data['quantity'])),
            unit=data.get('unit', '').strip(),
            unit_price=Decimal(str(data['unit_price'])),
            vat_rate_type=data.get('vat_rate_type', 'standard'),
            sort_order=data.get('sort_order', max_order),
        )
        item.save()  # _calculate_amounts() called in model.save()

        # Recalculate invoice totals
        VATCalculationService.recalculate_invoice_totals(invoice)

        logger.info(
            'Item added to invoice %s: %s (qty=%s, price=%s)',
            invoice.invoice_number, item.description, item.quantity, item.unit_price
        )
        return item

    @staticmethod
    def update_item(
        item: InvoiceItem,
        invoice: Invoice,
        membership: CompanyMember,
        data: dict,
    ) -> InvoiceItem:
        """Update a line item. Invoice must be DRAFT."""
        if not invoice.is_editable:
            raise ValidationError({
                'status': f'Cannot edit items on a "{invoice.status}" invoice.'
            })

        if membership.role not in ('admin', 'accountant'):
            raise PermissionDenied('Admin or Accountant role required to update invoice items.')

        updatable = ['item_name', 'description', 'quantity', 'unit', 'unit_price', 'vat_rate_type', 'sort_order']
        for field in updatable:
            if field in data:
                value = data[field]
                if field in ('quantity', 'unit_price'):
                    value = Decimal(str(value))
                elif isinstance(value, str):
                    value = value.strip()
                setattr(item, field, value)

        item.save()  # recalculates amounts
        VATCalculationService.recalculate_invoice_totals(invoice)

        logger.info('Item updated on invoice %s: %s', invoice.invoice_number, item.description)
        return item

    @staticmethod
    def remove_item(
        item: InvoiceItem,
        invoice: Invoice,
        membership: CompanyMember,
    ) -> None:
        """Soft-delete a line item. Invoice must be DRAFT."""
        if not invoice.is_editable:
            raise ValidationError({
                'status': f'Cannot remove items from a "{invoice.status}" invoice.'
            })

        if membership.role not in ('admin', 'accountant'):
            raise PermissionDenied('Admin or Accountant role required to remove items.')

        item.is_active = False
        item.save(update_fields=['is_active', 'updated_at'])

        VATCalculationService.recalculate_invoice_totals(invoice)
        logger.info('Item removed from invoice %s: %s', invoice.invoice_number, item.description)


# ─── Invoice Service ──────────────────────────────────────────────────────────

class InvoiceService:
    """Main invoice lifecycle management."""

    # ── Create ────────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def create_invoice(
        company: Company,
        membership: CompanyMember,
        data: dict,
    ) -> Invoice:
        """
        Create a new invoice in DRAFT status.

        Optionally accepts 'items' list to create line items in the same request.
        Invoice number is auto-generated (thread-safe, sequential per company).
        """
        if membership.role not in ('admin', 'accountant'):
            raise PermissionDenied('Admin or Accountant role required to create invoices.')

        # Resolve and validate customer belongs to this company
        customer_id = data.get('customer_id') or data.get('customer')
        try:
            customer = Customer.objects.get(
                id=customer_id,
                company=company,
                is_active=True,
            )
        except Customer.DoesNotExist:
            raise ValidationError({'customer_id': 'Customer not found in this company.'})

        # Validate credit note has a reference
        invoice_type = data.get('invoice_type', 'tax_invoice')
        if invoice_type == 'credit_note' and not data.get('reference_number'):
            raise ValidationError({
                'reference_number': 'Credit notes must reference the original invoice number.'
            })

        # Generate unique invoice number (uses SELECT FOR UPDATE)
        invoice_number, sequence = InvoiceNumberService.generate(company)

        invoice = Invoice.objects.create(
            company=company,
            customer=customer,
            created_by=membership.user,
            invoice_number=invoice_number,
            invoice_sequence=sequence,
            invoice_type=invoice_type,
            transaction_type=data.get('transaction_type', 'b2b'),
            issue_date=data.get('issue_date', timezone.localdate()),
            due_date=data.get('due_date'),
            supply_date=data.get('supply_date'),
            supply_date_end=data.get('supply_date_end'),
            contract_reference=data.get('contract_reference', ''),
            currency=data.get('currency', 'AED'),
            discount_amount=Decimal(str(data.get('discount_amount', '0.00'))),
            payment_means_code=data.get('payment_means_code', '30'),
            reference_number=data.get('reference_number', ''),
            purchase_order_number=data.get('purchase_order_number', ''),
            notes=data.get('notes', ''),
        )

        # Create line items if provided in the same request
        items_data = data.get('items', [])
        for item_data in items_data:
            InvoiceItemService.add_item(invoice, membership, item_data)

        logger.info(
            'Invoice created: %s (company: %s, customer: %s)',
            invoice.invoice_number, company.name, customer.name
        )
        return invoice

    # ── Update ────────────────────────────────────────────────────────────────

    @staticmethod
    def update_invoice(
        invoice: Invoice,
        membership: CompanyMember,
        data: dict,
    ) -> Invoice:
        """
        Update invoice header fields.
        Only DRAFT invoices can be modified.
        """
        if not invoice.is_editable:
            raise ValidationError({
                'status': f'Invoice "{invoice.invoice_number}" cannot be edited in '
                          f'"{invoice.status}" status. Only DRAFT invoices are editable.'
            })

        if membership.role not in ('admin', 'accountant'):
            raise PermissionDenied('Admin or Accountant role required to update invoices.')

        # Validate customer belongs to same company if being changed
        if 'customer_id' in data:
            try:
                customer = Customer.objects.get(
                    id=data['customer_id'],
                    company=invoice.company,
                    is_active=True,
                )
                invoice.customer = customer
            except Customer.DoesNotExist:
                raise ValidationError({'customer_id': 'Customer not found in this company.'})

        updatable = [
            'invoice_type', 'transaction_type', 'issue_date', 'due_date',
            'supply_date', 'supply_date_end', 'contract_reference',
            'currency', 'discount_amount', 'payment_means_code',
            'reference_number', 'purchase_order_number', 'notes',
        ]
        changed = []
        for field in updatable:
            if field in data:
                value = data[field]
                if field == 'discount_amount':
                    value = Decimal(str(value))
                setattr(invoice, field, value)
                changed.append(field)

        if 'customer' in locals():
            changed.append('customer')

        if changed:
            invoice.save(update_fields=changed + ['updated_at'])
            # Recalculate totals if discount changed
            if 'discount_amount' in data:
                VATCalculationService.recalculate_invoice_totals(invoice)

        logger.info('Invoice updated: %s — fields: %s', invoice.invoice_number, changed)
        return invoice

    # ── Status Transitions ────────────────────────────────────────────────────

    @staticmethod
    def submit_invoice(invoice: Invoice, membership: CompanyMember) -> Invoice:
        """
        Transition DRAFT → PENDING (queued for ASP submission).

        Validates:
        - Invoice must be DRAFT
        - Must have at least one active line item
        - Only Admin/Accountant can submit
        """
        if not invoice.is_submittable:
            if invoice.status != 'draft':
                raise ValidationError({
                    'status': f'Only DRAFT invoices can be submitted. Current: "{invoice.status}".'
                })
            raise ValidationError({
                'items': 'Invoice must have at least one line item before submission.'
            })

        if membership.role not in ('admin', 'accountant'):
            raise PermissionDenied('Admin or Accountant role required to submit invoices.')

        invoice.status = 'pending'
        invoice.save(update_fields=['status', 'updated_at'])

        # Enqueue async processing task (Celery → RabbitMQ)
        # Import here to avoid circular imports at module load time
        from tasks.invoice_tasks import process_invoice
        try:
            process_invoice.apply_async(
                args=[str(invoice.id)],
                queue='invoice_processing',
            )
        except Exception:
            # Celery/broker unavailable (development) — run synchronously
            logger.warning(
                'Celery unavailable for invoice %s — running pipeline synchronously.',
                invoice.invoice_number,
            )
            process_invoice.apply(args=[str(invoice.id)])

        logger.info('Invoice submitted for processing: %s', invoice.invoice_number)
        return invoice

    @staticmethod
    def cancel_invoice(invoice: Invoice, membership: CompanyMember) -> Invoice:
        """
        Cancel a DRAFT or PENDING invoice.
        Only Admin can cancel.
        """
        if not invoice.is_cancellable:
            raise ValidationError({
                'status': f'Invoice "{invoice.invoice_number}" cannot be cancelled in '
                          f'"{invoice.status}" status. Only DRAFT or PENDING invoices can be cancelled.'
            })

        if not membership.is_admin:
            raise PermissionDenied('Only company admins can cancel invoices.')

        invoice.status = 'cancelled'
        invoice.save(update_fields=['status', 'updated_at'])

        logger.warning('Invoice cancelled: %s', invoice.invoice_number)
        return invoice

    # ── ASP Status Updates (called from integration layer) ────────────────────

    @staticmethod
    def mark_submitted_to_asp(invoice: Invoice, submission_id: str) -> Invoice:
        """Called by ASP integration service after successful transmission."""
        invoice.status = 'submitted'
        invoice.asp_submission_id = submission_id
        invoice.asp_submitted_at = timezone.now()
        invoice.save(update_fields=['status', 'asp_submission_id', 'asp_submitted_at', 'updated_at'])
        return invoice

    @staticmethod
    def mark_validated(invoice: Invoice, asp_response: dict) -> Invoice:
        """Called when ASP confirms invoice is accepted and valid."""
        invoice.status = 'validated'
        invoice.asp_response = asp_response
        invoice.save(update_fields=['status', 'asp_response', 'updated_at'])
        logger.info('Invoice validated by ASP: %s', invoice.invoice_number)
        return invoice

    @staticmethod
    def mark_rejected(invoice: Invoice, asp_response: dict) -> Invoice:
        """Called when ASP rejects the invoice (validation failure, etc.)."""
        invoice.status = 'rejected'
        invoice.asp_response = asp_response
        invoice.save(update_fields=['status', 'asp_response', 'updated_at'])
        logger.warning(
            'Invoice rejected by ASP: %s — reason: %s',
            invoice.invoice_number, asp_response.get('message', 'Unknown')
        )
        return invoice

    # ── Queries ───────────────────────────────────────────────────────────────

    @staticmethod
    def get_company_invoices(
        company: Company,
        status: str = None,
        customer_id: str = None,
        invoice_type: str = None,
        date_from=None,
        date_to=None,
        search: str = None,
        created_by=None,   # If set, restrict to invoices created by this user
    ):
        """Return invoices for a company with optional filters.

        Pass created_by=request.user for suppliers/non-admin users so that
        each user sees only their own invoices. Admins pass None to see all.
        """
        from django.db.models import Q

        qs = Invoice.objects.filter(company=company, is_active=True).select_related('customer')

        if created_by is not None:
            qs = qs.filter(created_by=created_by)

        if status:
            qs = qs.filter(status=status)
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        if invoice_type:
            qs = qs.filter(invoice_type=invoice_type)
        if date_from:
            qs = qs.filter(issue_date__gte=date_from)
        if date_to:
            qs = qs.filter(issue_date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(reference_number__icontains=search)
            )

        return qs.order_by('-issue_date', '-invoice_sequence')

    @staticmethod
    def get_invoice_for_company(invoice_id: str, company: Company) -> Invoice:
        """Fetch invoice ensuring it belongs to the company."""
        try:
            return Invoice.objects.select_related('customer', 'company').get(
                id=invoice_id,
                company=company,
                is_active=True,
            )
        except Invoice.DoesNotExist:
            raise NotFound('Invoice not found.')

    @staticmethod
    def get_dashboard_stats(company: Company, created_by=None) -> dict:
        """
        Aggregate counts and totals for the dashboard.
        Pass created_by=request.user for per-user isolation.
        """
        from django.db.models import Count, Sum

        qs = Invoice.objects.filter(company=company, is_active=True)
        if created_by is not None:
            qs = qs.filter(created_by=created_by)

        status_counts = dict(
            qs.values('status')
              .annotate(count=Count('id'))
              .values_list('status', 'count')
        )

        revenue = qs.filter(
            status__in=['validated', 'paid']
        ).aggregate(
            total_revenue=Sum('total_amount'),
            total_vat=Sum('total_vat'),
        )

        return {
            'status_breakdown': status_counts,
            'total_invoices':   qs.count(),
            'total_revenue':    revenue['total_revenue'] or Decimal('0.00'),
            'total_vat':        revenue['total_vat']     or Decimal('0.00'),
        }
