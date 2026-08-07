"""
Buyer portal tests.

Covers:
- Buyer self-billed invoice creation (POST /api/v1/buyer/invoices/)
- Validation guards (items, credit-note reference/reason, due date)
- Role enforcement (buyer-only, 403 for non-buyers)
- Issuing-company + customer guards (inactive company, incomplete customer)
- Supplier-portal / admin-board visibility of buyer-created invoices
- /buyer/me/ includes seller-company + customer details for the wizard
"""
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.common.constants import ROLE_BUYER
from apps.companies.models import Company, CompanyMember
from apps.customers.models import Customer
from apps.invoices.models import Invoice
from apps.invoices.services import InvoiceService

from .models import BuyerProfile

User = get_user_model()


def make_user(email='u@t.com', role='admin', **kw):
    return User.objects.create_user(
        email=email, password='Pass123!', first_name='Test', last_name='User',
        role=role, **kw
    )


def make_company(trn='100000000000001'):
    return Company.objects.create(
        name='Supplier Co', legal_name='Supplier Co', trn=trn,
        street_address='Main St', city='Dubai', emirate='dubai', country='AE',
    )


def make_customer(company, trn='200000000000001'):
    return Customer.objects.create(
        company=company, name='Buyer LLC', customer_type='b2b', trn=trn,
        street_address='Sheikh Zayed Rd', city='Abu Dhabi', country='AE',
        email='buyer@example.com', phone='+971501234567',
    )


def make_buyer(company, email='buyer@example.com'):
    user = make_user(email=email, role=ROLE_BUYER)
    customer = make_customer(company)
    BuyerProfile.objects.create(user=user, customer=customer)
    return user, customer


INVOICE_PAYLOAD = {
    'invoice_type': 'tax_invoice',
    'transaction_type': 'b2b',
    'payment_means_code': '30',
    'issue_date': '2026-07-31',
    'due_date': '2026-08-31',
    'currency': 'AED',
    'exchange_rate': '1.000000',
    'reference_number': '',
    'credit_note_reason_code': '',
    'purchase_order_number': '',
    'items': [{
        'item_name': 'Consulting services',
        'description': 'Consulting services for July',
        'quantity': '2',
        'unit': 'hr',
        'unit_price': '500.00',
        'vat_rate_type': 'standard',
    }],
}


class BuyerInvoiceCreateTest(TestCase):

    def setUp(self):
        self.company = make_company()
        self.admin = make_user(email='admin@supplier.com', role='admin')
        CompanyMember.objects.create(company=self.company, user=self.admin, role='admin')
        self.buyer, self.customer = make_buyer(self.company)
        self.client = APIClient()

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    @patch('tasks.invoice_tasks.process_invoice')
    def test_create_tax_invoice_success(self, mock_pipeline):
        self._auth(self.buyer)
        response = self.client.post('/api/v1/buyer/invoices/', INVOICE_PAYLOAD, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        invoice = Invoice.objects.get(id=response.data['data']['id'])
        self.assertEqual(invoice.status, 'draft')
        self.assertEqual(invoice.created_by, self.buyer)
        self.assertEqual(invoice.customer, self.customer)
        self.assertEqual(invoice.company, self.company)
        self.assertTrue(invoice.invoice_number.startswith('INV-'))
        self.assertEqual(invoice.invoice_type, 'tax_invoice')
        self.assertEqual(invoice.total_amount, Decimal('1050.00'))
        self.assertEqual(invoice.total_vat, Decimal('50.00'))
        mock_pipeline.apply_async.assert_not_called()

    def _details(self, response):
        return response.data.get('error', {}).get('details', {})

    @patch('tasks.invoice_tasks.process_invoice')
    def test_create_draft_not_submitted_to_pipeline(self, mock_pipeline):
        """Buyer-created invoice is saved as DRAFT; the ASP pipeline is not
        triggered until the supplier sends it for approval and the buyer approves."""
        self._auth(self.buyer)
        response = self.client.post('/api/v1/buyer/invoices/', INVOICE_PAYLOAD, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        invoice = Invoice.objects.get(id=response.data['data']['id'])
        self.assertEqual(invoice.status, 'draft')
        self.assertIn('draft', response.data['message'].lower())
        mock_pipeline.apply_async.assert_not_called()
        mock_pipeline.apply.assert_not_called()

    @patch('tasks.invoice_tasks.process_invoice')
    def test_full_workflow_draft_supplier_sends_buyer_approves(self, mock_pipeline):
        """Buyer creates a draft → supplier sends it for approval → buyer approves
        → invoice moves to PENDING and the ASP pipeline is triggered."""
        self._auth(self.buyer)
        response = self.client.post('/api/v1/buyer/invoices/', INVOICE_PAYLOAD, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        invoice = Invoice.objects.get(id=response.data['data']['id'])
        self.assertEqual(invoice.status, 'draft')

        # Supplier admin reviews and sends the draft to the buyer for approval.
        self.client.force_authenticate(user=self.admin)
        sent = self.client.post(f'/api/v1/invoices/{invoice.id}/send-for-approval/')
        self.assertEqual(sent.status_code, 200, sent.data)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, 'awaiting_approval')

        # Buyer approves + e-signs; invoice moves to PENDING and is submitted.
        self.client.force_authenticate(user=self.buyer)
        approved = self.client.post(
            f'/api/v1/buyer/invoices/{invoice.id}/approve/',
            {'signed_name': 'Buyer User'},
            format='json',
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, 'pending')
        mock_pipeline.apply_async.assert_called_once()
        mock_pipeline.apply.assert_not_called()

    @patch('tasks.invoice_tasks.process_invoice')
    def test_credit_note_requires_reference_number(self, mock_pipeline):
        self._auth(self.buyer)
        payload = {**INVOICE_PAYLOAD, 'invoice_type': 'credit_note', 'reference_number': ''}
        response = self.client.post('/api/v1/buyer/invoices/', payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('reference_number', self._details(response))

    @patch('tasks.invoice_tasks.process_invoice')
    def test_credit_note_requires_reason_code(self, mock_pipeline):
        self._auth(self.buyer)
        payload = {
            **INVOICE_PAYLOAD,
            'invoice_type': 'credit_note',
            'reference_number': 'INV-202601-000001',
            'credit_note_reason_code': '',
        }
        response = self.client.post('/api/v1/buyer/invoices/', payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('credit_note_reason_code', self._details(response))

    @patch('tasks.invoice_tasks.process_invoice')
    def test_empty_items_rejected(self, mock_pipeline):
        self._auth(self.buyer)
        payload = {**INVOICE_PAYLOAD, 'items': []}
        response = self.client.post('/api/v1/buyer/invoices/', payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('items', self._details(response))

    @patch('tasks.invoice_tasks.process_invoice')
    def test_due_date_before_issue_date_rejected(self, mock_pipeline):
        self._auth(self.buyer)
        payload = {
            **INVOICE_PAYLOAD,
            'issue_date': '2026-08-31',
            'due_date': '2026-08-01',
        }
        response = self.client.post('/api/v1/buyer/invoices/', payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('due_date', self._details(response))

    @patch('tasks.invoice_tasks.process_invoice')
    def test_non_buyer_denied(self, mock_pipeline):
        self._auth(self.admin)
        response = self.client.post('/api/v1/buyer/invoices/', INVOICE_PAYLOAD, format='json')
        self.assertEqual(response.status_code, 403)

    @patch('tasks.invoice_tasks.process_invoice')
    def test_inactive_company_denied(self, mock_pipeline):
        self.company.is_active = False
        self.company.save(update_fields=['is_active'])
        self._auth(self.buyer)

        response = self.client.post('/api/v1/buyer/invoices/', INVOICE_PAYLOAD, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Invoice.objects.count(), 0)

    @patch('tasks.invoice_tasks.process_invoice')
    def test_incomplete_customer_rejected(self, mock_pipeline):
        self.customer.email = ''
        self.customer.save(update_fields=['email'])
        self._auth(self.buyer)

        response = self.client.post('/api/v1/buyer/invoices/', INVOICE_PAYLOAD, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('missing_fields', self._details(response))
        self.assertEqual(Invoice.objects.count(), 0)

    @patch('tasks.invoice_tasks.process_invoice')
    def test_create_notifies_supplier_members_not_buyer(self, mock_pipeline):
        from apps.notifications.models import Notification
        accountant = make_user(email='acct@supplier.com', role='accountant')
        CompanyMember.objects.create(company=self.company, user=accountant, role='accountant')

        self._auth(self.buyer)
        response = self.client.post('/api/v1/buyer/invoices/', INVOICE_PAYLOAD, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        invoice = Invoice.objects.get(id=response.data['data']['id'])

        member_notes = Notification.objects.filter(
            user__in=[self.admin, accountant], event='buyer_created_invoice'
        )
        self.assertEqual(member_notes.count(), 2)
        for n in member_notes:
            self.assertEqual(n.link, f'/invoices/{invoice.id}')

        buyer_notes = Notification.objects.filter(
            user=self.buyer, event='buyer_created_invoice'
        )
        self.assertFalse(buyer_notes.exists())


class BuyerVisibilityTest(TestCase):

    def setUp(self):
        self.company = make_company()
        self.supplier = make_user(email='supplier@co.com', role='supplier')
        CompanyMember.objects.create(company=self.company, user=self.supplier, role='supplier')
        self.buyer, self.customer = make_buyer(self.company)
        self._make_buyer_invoice()

    def _make_buyer_invoice(self):
        from apps.invoices.services import InvoiceNumberService
        number, seq = InvoiceNumberService.generate(self.company)
        return Invoice.objects.create(
            company=self.company, customer=self.customer,
            created_by=self.buyer, invoice_number=number, invoice_sequence=seq,
            status='pending',
        )

    def test_non_admin_supplier_sees_buyer_created_invoices(self):
        invoices = InvoiceService.get_company_invoices(
            company=self.company, created_by=self.supplier
        )
        self.assertEqual(invoices.count(), 1)

    def test_dashboard_stats_include_buyer_created_invoices(self):
        stats = InvoiceService.get_dashboard_stats(company=self.company, created_by=self.supplier)
        self.assertEqual(stats['total_invoices'], 1)

    def test_admin_sees_all_invoices(self):
        invoices = InvoiceService.get_company_invoices(company=self.company, created_by=None)
        self.assertEqual(invoices.count(), 1)


class BuyerNotificationTest(TestCase):
    """Who gets notified when a buyer opens/creates invoices."""

    def setUp(self):
        self.company = make_company()
        self.supplier = make_user(email='supplier@co.com', role='supplier')
        CompanyMember.objects.create(company=self.company, user=self.supplier, role='supplier')
        self.buyer, self.customer = make_buyer(self.company)
        self.client = APIClient()
        self.client.force_authenticate(user=self.buyer)

    def _make_invoice(self, created_by):
        from apps.invoices.services import InvoiceNumberService
        number, seq = InvoiceNumberService.generate(self.company)
        return Invoice.objects.create(
            company=self.company, customer=self.customer,
            created_by=created_by, invoice_number=number, invoice_sequence=seq,
            status='pending',
        )

    def test_open_supplier_created_invoice_notifies_supplier_not_buyer(self):
        from apps.notifications.models import Notification
        invoice = self._make_invoice(self.supplier)

        response = self.client.get(f'/api/v1/buyer/invoices/{invoice.id}/')
        self.assertEqual(response.status_code, 200, response.data)

        self.assertTrue(Notification.objects.filter(
            user=self.supplier, event='buyer_viewed',
            link=f'/invoices/{invoice.id}',
        ).exists())
        self.assertFalse(Notification.objects.filter(
            user=self.buyer, event='buyer_viewed'
        ).exists())

    def test_open_self_billed_invoice_notifies_no_one(self):
        from apps.notifications.models import Notification
        invoice = self._make_invoice(self.buyer)

        response = self.client.get(f'/api/v1/buyer/invoices/{invoice.id}/')
        self.assertEqual(response.status_code, 200, response.data)

        self.assertEqual(
            Notification.objects.filter(event='buyer_viewed').count(), 0
        )


class BuyerProfileTest(TestCase):

    def setUp(self):
        self.company = make_company()
        self.buyer, self.customer = make_buyer(self.company)
        self.client = APIClient()
        self.client.force_authenticate(user=self.buyer)

    def test_me_includes_seller_company_and_customer(self):
        response = self.client.get('/api/v1/buyer/me/')
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data['data']
        self.assertEqual(data['company_id'], str(self.company.id))
        self.assertEqual(data['company_name'], self.company.name)
        self.assertEqual(data['company_trn'], self.company.trn)
        self.assertEqual(data['customer_id'], str(self.customer.id))
        self.assertEqual(data['customer_name'], self.customer.name)
        self.assertEqual(data['customer_trn'], self.customer.trn)
        self.assertEqual(data['customer_email'], self.customer.email)

    def test_me_denied_for_non_buyer(self):
        supplier = make_user(email='other@co.com', role='supplier')
        self.client.force_authenticate(user=supplier)
        response = self.client.get('/api/v1/buyer/me/')
        self.assertEqual(response.status_code, 403)


class BuyerInviteValidationTest(TestCase):
    """One email = one role: invite must be rejected when the email already owns an account."""

    def setUp(self):
        self.company = make_company()
        self.customer = make_customer(self.company)
        self.admin = make_user(email='admin@co.com', role='admin')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.url = '/api/v1/buyers/invite/'
        self.payload = {'customer_id': str(self.customer.id), 'email': 'invitee@example.com'}

    def test_invite_rejected_when_email_owned_by_other_role(self):
        make_user(email='invitee@example.com', role='supplier')
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('role', response.data['error']['message'].lower())

    def test_invite_rejected_when_buyer_account_already_exists(self):
        make_user(email='invitee@example.com', role=ROLE_BUYER)
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('buyer account', response.data['error']['message'].lower())

    def test_duplicate_active_invite_rejected(self):
        from django.utils import timezone
        from .models import BuyerInvite
        BuyerInvite.objects.create(
            customer=self.customer, email='invitee@example.com',
            invited_by=self.admin,
            expires_at=timezone.now() + timezone.timedelta(days=3),
        )
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('active invitation', response.data['error']['message'].lower())

    def test_duplicate_expired_invite_allows_new_one(self):
        from django.utils import timezone
        from unittest.mock import patch
        from .models import BuyerInvite
        BuyerInvite.objects.create(
            customer=self.customer, email='invitee@example.com',
            invited_by=self.admin,
            expires_at=timezone.now() - timezone.timedelta(hours=1),
        )
        with patch('services.emails.send_branded_email'):
            response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, 200, response.data)

