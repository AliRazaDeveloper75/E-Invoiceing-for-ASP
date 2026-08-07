"""
Customers app tests.

Covers:
- Customer model (TIN auto-derivation, UAE B2B TRN validation)
- Create API (company scoping, role enforcement)
- List API (filters: search, type, country)
- Update API (role guard, TRN conflict)
- Delete API (soft delete, admin-only)
- Non-member access blocked
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from apps.companies.models import Company, CompanyMember
from .models import Customer

User = get_user_model()

# ─── Fixtures ─────────────────────────────────────────────────────────────────

def make_user(email='u@test.com', **kwargs):
    return User.objects.create_user(
        email=email, password='Pass123!',
        first_name='Test', last_name='User', **kwargs
    )

def make_company(trn='100000000000001'):
    return Company.objects.create(
        name='Test Co', legal_name='Test Co', trn=trn,
        street_address='Main St', city='Dubai', emirate='dubai',
    )

def make_membership(company, user, role='admin'):
    return CompanyMember.objects.create(company=company, user=user, role=role)

def make_customer(company, name='Al Futtaim LLC', trn='200000000000001'):
    return Customer.objects.create(
        company=company, name=name, customer_type='b2b',
        trn=trn, country='AE',
    )


def make_logo():
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', (1, 1), color=(255, 255, 255)).save(buf, format='PNG')
    return SimpleUploadedFile('logo.png', buf.getvalue(), content_type='image/png')


def make_trn_document():
    pdf = b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF'
    return SimpleUploadedFile('trn.pdf', pdf, content_type='application/pdf')


# ─── Model Tests ──────────────────────────────────────────────────────────────

class CustomerModelTest(TestCase):

    def setUp(self):
        self.company = make_company()

    def test_tin_auto_derived_from_trn(self):
        c = make_customer(self.company)
        self.assertEqual(c.tin, '2000000000')

    def test_legal_name_defaults_to_name(self):
        c = Customer.objects.create(
            company=self.company, name='Beta Corp',
            customer_type='b2b', trn='200000000000002', country='AE',
        )
        self.assertEqual(c.legal_name, 'Beta Corp')

    def test_uae_b2b_without_trn_fails_validation(self):
        from django.core.exceptions import ValidationError
        c = Customer(
            company=self.company, name='No TRN',
            customer_type='b2b', country='AE',
        )
        with self.assertRaises(ValidationError):
            c.full_clean()

    def test_international_b2b_without_trn_is_valid(self):
        """Non-UAE customers don't need a TRN."""
        c = Customer(
            company=self.company, name='UK Buyer',
            customer_type='b2b', country='GB', vat_number='GB123456789',
        )
        c.full_clean()  # Should not raise

    def test_is_peppol_connected_property(self):
        c = make_customer(self.company)
        self.assertFalse(c.is_peppol_connected)
        c.peppol_endpoint = '0088:1234567890123'
        self.assertTrue(c.is_peppol_connected)


# ─── List API Tests ───────────────────────────────────────────────────────────

class CustomerListAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user('admin@t.com')
        self.company = make_company()
        make_membership(self.company, self.admin, 'admin')
        make_customer(self.company, 'Alpha LLC',  '200000000000001')
        make_customer(self.company, 'Beta Corp',  '200000000000002')
        self.client.force_authenticate(user=self.admin)

    def test_list_returns_company_customers(self):
        url = f'/api/v1/customers/?company_id={self.company.id}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pagination']['count'], 2)

    def test_search_filter(self):
        url = f'/api/v1/customers/?company_id={self.company.id}&search=Alpha'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pagination']['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'Alpha LLC')

    def test_customer_type_filter(self):
        # Add a B2G customer
        Customer.objects.create(
            company=self.company, name='Dubai Municipality',
            customer_type='b2g', trn='300000000000001', country='AE',
        )
        url = f'/api/v1/customers/?company_id={self.company.id}&customer_type=b2g'
        response = self.client.get(url)
        self.assertEqual(response.data['pagination']['count'], 1)

    def test_non_member_cannot_list(self):
        outsider = make_user('out@t.com')
        self.client.force_authenticate(user=outsider)
        url = f'/api/v1/customers/?company_id={self.company.id}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_company_id_returns_400(self):
        response = self.client.get('/api/v1/customers/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ─── Create API Tests ─────────────────────────────────────────────────────────

class CustomerCreateAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user('admin@t.com')
        self.viewer = make_user('viewer@t.com')
        self.company = make_company()
        make_membership(self.company, self.admin, 'admin')
        make_membership(self.company, self.viewer, 'viewer')
        self.url = '/api/v1/customers/'
        self.valid_payload = {
            'company_id': str(self.company.id),
            'name': 'Emaar Properties',
            'customer_type': 'b2b',
            'trn': '200000000000003',
            'country': 'AE',
            'email': 'ap@emaar.ae',
        }

    def test_admin_creates_customer(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            **self.valid_payload,
            'logo': make_logo(),
            'trn_document': make_trn_document(),
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['tin'], '2000000000')

    def test_viewer_cannot_create_customer(self):
        self.client.force_authenticate(user=self.viewer)
        payload = {
            **self.valid_payload,
            'logo': make_logo(),
            'trn_document': make_trn_document(),
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_uae_b2b_without_trn_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            **self.valid_payload,
            'trn': '',
            'country': 'AE',
            'logo': make_logo(),
            'trn_document': make_trn_document(),
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('trn', response.data['error']['details'])

    def test_duplicate_trn_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            **self.valid_payload,
            'logo': make_logo(),
            'trn_document': make_trn_document(),
        }
        self.client.post(self.url, payload, format='multipart')
        duplicate = {
            **self.valid_payload,
            'logo': make_logo(),
            'trn_document': make_trn_document(),
        }
        response = self.client.post(self.url, duplicate, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('trn', response.data['error']['details'])

    def test_b2c_can_be_created_without_trn_document(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            **self.valid_payload,
            'customer_type': 'b2c',
            'trn': '',
            'logo': make_logo(),
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['customer_type'], 'b2c')
        self.assertIsNone(response.data['data']['trn_document'])

    def test_b2b_requires_trn_document(self):
        self.client.force_authenticate(user=self.admin)
        payload = {**self.valid_payload, 'logo': make_logo()}
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('trn_document', response.data['error']['details'])

    def test_b2c_with_trn_document_is_accepted(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            **self.valid_payload,
            'customer_type': 'b2c',
            'trn': '',
            'logo': make_logo(),
            'trn_document': make_trn_document(),
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data['data']['trn_document'])

    def test_disguised_logo_rejected(self):
        """A non-image renamed to .png must be rejected by magic-byte check."""
        self.client.force_authenticate(user=self.admin)
        fake_logo = SimpleUploadedFile('logo.png', b'not-a-real-png', content_type='image/png')
        payload = {
            **self.valid_payload,
            'customer_type': 'b2c',
            'trn': '',
            'logo': fake_logo,
            'trn_document': make_trn_document(),
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('logo', response.data['error']['details'])

    def test_pdf_rejected_as_logo(self):
        self.client.force_authenticate(user=self.admin)
        pdf_as_logo = SimpleUploadedFile('logo.png', b'%PDF-1.4\nfake', content_type='application/pdf')
        payload = {
            **self.valid_payload,
            'customer_type': 'b2c',
            'trn': '',
            'logo': pdf_as_logo,
            'trn_document': make_trn_document(),
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('logo', response.data['error']['details'])

    def test_disguised_trn_document_rejected(self):
        self.client.force_authenticate(user=self.admin)
        fake_doc = SimpleUploadedFile('trn.pdf', b'just-some-text', content_type='application/pdf')
        payload = {
            **self.valid_payload,
            'customer_type': 'b2c',
            'trn': '',
            'logo': make_logo(),
            'trn_document': fake_doc,
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('trn_document', response.data['error']['details'])


# ─── One Email = One Role Tests ──────────────────────────────────────────────

class CustomerOneRoleTest(TestCase):
    """
    A single email = a single role. Customer contact emails must not reuse a
    platform account email (supplier / buyer / admin / etc.), matching the
    guards already in place for buyers, onboarding, admin panel, and inbound.
    """

    def setUp(self):
        self.client = APIClient()
        self.supplier = make_user('supplier@t.com', role='supplier')
        self.buyer = make_user('buyer@t.com', role='buyer')
        self.company = make_company()
        make_membership(self.company, self.supplier, 'admin')
        self.url = '/api/v1/customers/'
        self.valid_payload = {
            'company_id': str(self.company.id),
            'name': 'Emaar Properties',
            'customer_type': 'b2b',
            'trn': '200000000000004',
            'country': 'AE',
            'email': 'ap@emaar.ae',
            'logo': make_logo(),
            'trn_document': make_trn_document(),
        }

    def test_supplier_email_cannot_be_used_as_customer_email(self):
        """The logged-in supplier's own email cannot also be a buyer's contact."""
        self.client.force_authenticate(user=self.supplier)
        payload = {**self.valid_payload, 'email': self.supplier.email}
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data['error']['details'])
        self.assertIn('Supplier account', str(response.data['error']['details']['email']))

    def test_buyer_email_cannot_be_used_as_customer_email(self):
        self.client.force_authenticate(user=self.supplier)
        payload = {**self.valid_payload, 'email': self.buyer.email}
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data['error']['details'])
        self.assertIn('buyer account', str(response.data['error']['details']['email']).lower())

    def test_unregistered_email_creates_customer(self):
        self.client.force_authenticate(user=self.supplier)
        response = self.client.post(self.url, self.valid_payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_update_to_platform_account_email_rejected(self):
        customer = make_customer(self.company, 'Alpha LLC', '200000000000001')
        self.client.force_authenticate(user=self.supplier)
        response = self.client.put(
            f'/api/v1/customers/{customer.id}/',
            {'email': self.supplier.email},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data['error']['details'])

    def test_update_unchanged_email_not_locked_out(self):
        """Editing a customer whose email matches a platform account (e.g. legacy
        data) must succeed as long as the email itself isn't being changed."""
        customer = make_customer(self.company, 'Alpha LLC', '200000000000001')
        customer.email = self.supplier.email
        customer.save(update_fields=['email'])
        self.client.force_authenticate(user=self.supplier)
        response = self.client.put(
            f'/api/v1/customers/{customer.id}/',
            {'name': 'Alpha LLC Updated'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['name'], 'Alpha LLC Updated')


# ─── Detail / Update / Delete Tests ──────────────────────────────────────────

class CustomerDetailAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user('admin@t.com')
        self.accountant = make_user('acc@t.com')
        self.viewer = make_user('viewer@t.com')
        self.company = make_company()
        make_membership(self.company, self.admin, 'admin')
        make_membership(self.company, self.accountant, 'accountant')
        make_membership(self.company, self.viewer, 'viewer')
        self.customer = make_customer(self.company)

    def test_any_member_can_retrieve(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.get(f'/api/v1/customers/{self.customer.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['name'], self.customer.name)

    def test_accountant_can_update(self):
        self.client.force_authenticate(user=self.accountant)
        response = self.client.put(
            f'/api/v1/customers/{self.customer.id}/',
            {'name': 'Updated Name'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['name'], 'Updated Name')

    def test_viewer_cannot_update(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.put(
            f'/api/v1/customers/{self.customer.id}/',
            {'name': 'Hacked'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_soft_delete(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f'/api/v1/customers/{self.customer.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

    def test_non_member_gets_404(self):
        outsider = make_user('out@t.com')
        self.client.force_authenticate(user=outsider)
        response = self.client.get(f'/api/v1/customers/{self.customer.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
