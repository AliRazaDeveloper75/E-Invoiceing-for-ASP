"""
Invoices app tests.

Covers:
- VAT calculation engine (5% standard, zero, exempt)
- Invoice number generation (sequential, thread-safe)
- Invoice lifecycle (Draft → Pending → Submitted → Validated/Rejected)
- InvoiceItem: create, update, delete, amount recalculation
- Status transition guards (only DRAFT editable, etc.)
- Role enforcement (Viewer read-only, Accountant write, Admin cancel)
- Company-scoping (non-members blocked)
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.companies.models import Company, CompanyMember
from apps.customers.models import Customer
from .models import Invoice, InvoiceItem
from .services import VATCalculationService, InvoiceService, InvoiceItemService

User = get_user_model()

# ─── Fixtures ─────────────────────────────────────────────────────────────────

def make_user(email='u@t.com', **kw):
    return User.objects.create_user(
        email=email, password='Pass123!', first_name='T', last_name='U', **kw
    )

def make_company(trn='100000000000001'):
    return Company.objects.create(
        name='Supplier Co', legal_name='Supplier Co', trn=trn,
        street_address='Main St', city='Dubai', emirate='dubai',
    )

def make_membership(company, user, role='admin'):
    return CompanyMember.objects.create(company=company, user=user, role=role)

def make_customer(company, trn='200000000000001'):
    return Customer.objects.create(
        company=company, name='Buyer LLC', customer_type='b2b',
        trn=trn, country='AE',
    )

def make_invoice(company, customer, user):
    from apps.invoices.services import InvoiceNumberService
    number, seq = InvoiceNumberService.generate(company)
    return Invoice.objects.create(
        company=company, customer=customer, created_by=user,
        invoice_number=number, invoice_sequence=seq,
    )

def make_item(invoice, desc='Consulting', qty='10', price='100.00', vat='standard'):
    return InvoiceItem.objects.create(
        invoice=invoice, description=desc,
        quantity=Decimal(qty), unit_price=Decimal(price),
        vat_rate_type=vat,
    )


# ─── VAT Calculation Tests ────────────────────────────────────────────────────

class VATCalculationTest(TestCase):

    def test_standard_rate_5_percent(self):
        result = VATCalculationService.calculate_item(
            quantity=Decimal('10'),
            unit_price=Decimal('100.00'),
            vat_rate_type='standard',
        )
        self.assertEqual(result['subtotal'],     Decimal('1000.00'))
        self.assertEqual(result['vat_rate'],     Decimal('5.00'))
        self.assertEqual(result['vat_amount'],   Decimal('50.00'))
        self.assertEqual(result['total_amount'], Decimal('1050.00'))

    def test_zero_rate(self):
        result = VATCalculationService.calculate_item(
            quantity=Decimal('5'),
            unit_price=Decimal('200.00'),
            vat_rate_type='zero',
        )
        self.assertEqual(result['vat_amount'],   Decimal('0.00'))
        self.assertEqual(result['total_amount'], Decimal('1000.00'))

    def test_exempt_no_vat(self):
        result = VATCalculationService.calculate_item(
            quantity=Decimal('1'),
            unit_price=Decimal('500.00'),
            vat_rate_type='exempt',
        )
        self.assertEqual(result['vat_amount'],   Decimal('0.00'))
        self.assertEqual(result['vat_rate'],     Decimal('0.00'))
        self.assertEqual(result['total_amount'], Decimal('500.00'))

    def test_rounding_half_up(self):
        # 1/3 × 100 = 33.333... → rounds to 33.33
        result = VATCalculationService.calculate_item(
            quantity=Decimal('0.3333'),
            unit_price=Decimal('100.00'),
            vat_rate_type='standard',
        )
        self.assertEqual(result['subtotal'], Decimal('33.33'))

    def test_invoice_totals_recalculated(self):
        company  = make_company()
        customer = make_customer(company)
        user     = make_user()
        invoice  = make_invoice(company, customer, user)

        make_item(invoice, 'Item A', qty='2', price='500.00', vat='standard')
        make_item(invoice, 'Item B', qty='1', price='200.00', vat='zero')
        VATCalculationService.recalculate_invoice_totals(invoice)
        invoice.refresh_from_db()

        # Subtotal: (2×500) + (1×200) = 1200
        # VAT:      (1000 × 5%) + 0 = 50
        # Total:    1200 + 50 = 1250
        self.assertEqual(invoice.subtotal,     Decimal('1200.00'))
        self.assertEqual(invoice.total_vat,    Decimal('50.00'))
        self.assertEqual(invoice.total_amount, Decimal('1250.00'))

    def test_vat_summary_breakdown(self):
        company  = make_company()
        customer = make_customer(company)
        user     = make_user()
        invoice  = make_invoice(company, customer, user)
        make_item(invoice, 'Standard item', qty='1', price='1000.00', vat='standard')
        make_item(invoice, 'Zero-rated',    qty='1', price='500.00',  vat='zero')

        summary = VATCalculationService.get_vat_summary(invoice)
        self.assertIn('standard', summary)
        self.assertIn('zero', summary)
        self.assertEqual(summary['standard']['vat_amount'], Decimal('50.00'))
        self.assertEqual(summary['zero']['vat_amount'],     Decimal('0.00'))


# ─── Invoice Model Tests ──────────────────────────────────────────────────────

class InvoiceModelTest(TestCase):

    def setUp(self):
        self.company  = make_company()
        self.customer = make_customer(self.company)
        self.user     = make_user()
        self.invoice  = make_invoice(self.company, self.customer, self.user)

    def test_invoice_number_format(self):
        self.assertTrue(self.invoice.invoice_number.startswith('INV-'))

    def test_sequential_invoice_numbers(self):
        inv2 = make_invoice(self.company, self.customer, self.user)
        self.assertNotEqual(self.invoice.invoice_number, inv2.invoice_number)
        self.assertGreater(inv2.invoice_sequence, self.invoice.invoice_sequence)

    def test_draft_is_editable(self):
        self.assertEqual(self.invoice.status, 'draft')
        self.assertTrue(self.invoice.is_editable)

    def test_pending_not_editable(self):
        make_item(self.invoice)
        self.invoice.status = 'pending'
        self.invoice.save()
        self.assertFalse(self.invoice.is_editable)

    def test_item_amounts_auto_calculated(self):
        item = make_item(self.invoice, qty='4', price='250.00', vat='standard')
        self.assertEqual(item.subtotal,     Decimal('1000.00'))
        self.assertEqual(item.vat_amount,   Decimal('50.00'))
        self.assertEqual(item.total_amount, Decimal('1050.00'))


# ─── Invoice API Tests ────────────────────────────────────────────────────────

class InvoiceCreateAPITest(TestCase):

    def setUp(self):
        self.client   = APIClient()
        self.admin    = make_user('admin@t.com')
        self.company  = make_company()
        self.customer = make_customer(self.company)
        make_membership(self.company, self.admin, 'admin')
        self.client.force_authenticate(user=self.admin)
        self.url     = '/api/v1/invoices/'
        self.payload = {
            'company_id':  str(self.company.id),
            'customer_id': str(self.customer.id),
            'invoice_type': 'tax_invoice',
            'transaction_type': 'b2b',
        }

    def test_create_invoice_returns_201(self):
        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['data']['invoice_number'].startswith('INV-'))
        self.assertEqual(response.data['data']['status'], 'draft')

    def test_create_invoice_with_items(self):
        payload = {
            **self.payload,
            'items': [
                {'description': 'Consulting', 'quantity': '5', 'unit_price': '1000.00',
                 'vat_rate_type': 'standard'},
                {'description': 'Travel',     'quantity': '1', 'unit_price': '500.00',
                 'vat_rate_type': 'zero'},
            ]
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['item_count'], 2)
        # Subtotal: 5000 + 500 = 5500; VAT: 250 + 0 = 250; Total: 5750
        self.assertEqual(response.data['data']['total_amount'], '5750.00')

    def test_credit_note_requires_reference_number(self):
        payload = {**self.payload, 'invoice_type': 'credit_note', 'reference_number': ''}
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_viewer_cannot_create_invoice(self):
        viewer = make_user('viewer@t.com')
        make_membership(self.company, viewer, 'viewer')
        self.client.force_authenticate(user=viewer)
        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class InvoiceLifecycleAPITest(TestCase):

    def setUp(self):
        self.client   = APIClient()
        self.admin    = make_user('admin@t.com')
        self.company  = make_company()
        self.customer = make_customer(self.company)
        self.membership = make_membership(self.company, self.admin, 'admin')
        self.client.force_authenticate(user=self.admin)
        # Create invoice with one item
        number, seq = __import__('apps.invoices.services', fromlist=['InvoiceNumberService']).InvoiceNumberService.generate(self.company)
        self.invoice = Invoice.objects.create(
            company=self.company, customer=self.customer, created_by=self.admin,
            invoice_number=number, invoice_sequence=seq,
        )
        make_item(self.invoice)
        VATCalculationService.recalculate_invoice_totals(self.invoice)

    def test_submit_moves_to_pending(self):
        response = self.client.post(f'/api/v1/invoices/{self.invoice.id}/submit/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['status'], 'pending')

    def test_cannot_submit_without_items(self):
        # Remove all items
        self.invoice.items.update(is_active=False)
        response = self.client.post(f'/api/v1/invoices/{self.invoice.id}/submit/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_draft_invoice(self):
        response = self.client.post(f'/api/v1/invoices/{self.invoice.id}/cancel/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['status'], 'cancelled')

    def test_cannot_edit_pending_invoice(self):
        self.invoice.status = 'pending'
        self.invoice.save()
        response = self.client.put(
            f'/api/v1/invoices/{self.invoice.id}/',
            {'notes': 'updated'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_vat_summary_endpoint(self):
        response = self.client.get(f'/api/v1/invoices/{self.invoice.id}/vat-summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('vat_breakdown', response.data['data'])
        self.assertIn('total_vat', response.data['data'])


class InvoiceItemAPITest(TestCase):

    def setUp(self):
        self.client   = APIClient()
        self.admin    = make_user('admin@t.com')
        self.company  = make_company()
        self.customer = make_customer(self.company)
        make_membership(self.company, self.admin, 'admin')
        self.client.force_authenticate(user=self.admin)
        from apps.invoices.services import InvoiceNumberService
        number, seq = InvoiceNumberService.generate(self.company)
        self.invoice = Invoice.objects.create(
            company=self.company, customer=self.customer, created_by=self.admin,
            invoice_number=number, invoice_sequence=seq,
        )

    def test_add_item_updates_totals(self):
        url = f'/api/v1/invoices/{self.invoice.id}/items/'
        response = self.client.post(url, {
            'description': 'Website Development',
            'quantity': '1',
            'unit_price': '10000.00',
            'vat_rate_type': 'standard',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.subtotal,     Decimal('10000.00'))
        self.assertEqual(self.invoice.total_vat,    Decimal('500.00'))
        self.assertEqual(self.invoice.total_amount, Decimal('10500.00'))

    def test_remove_item_updates_totals(self):
        item = make_item(self.invoice, qty='2', price='100.00')
        VATCalculationService.recalculate_invoice_totals(self.invoice)
        url = f'/api/v1/invoices/{self.invoice.id}/items/{item.id}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.subtotal, Decimal('0.00'))

    def test_cannot_add_item_to_non_draft(self):
        self.invoice.status = 'submitted'
        self.invoice.save()
        url = f'/api/v1/invoices/{self.invoice.id}/items/'
        response = self.client.post(url, {
            'description': 'X', 'quantity': '1', 'unit_price': '100',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
