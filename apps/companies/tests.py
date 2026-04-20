"""
Companies app tests.

Covers:
- Company model (TRN validation, TIN auto-derivation)
- Company creation API (auto-admin membership)
- Member management (add, remove, role change)
- Permission enforcement (non-members blocked, non-admins blocked for writes)
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from .models import Company, CompanyMember

User = get_user_model()

# ─── Fixtures ─────────────────────────────────────────────────────────────────

def make_user(email='user@test.com', role='admin', **kwargs):
    return User.objects.create_user(
        email=email, password='StrongPass123!',
        first_name='Test', last_name='User', role=role, **kwargs
    )

def make_company(trn='100000000000001', name='Test Co'):
    return Company.objects.create(
        name=name, legal_name=name, trn=trn,
        street_address='123 Main St', city='Dubai', emirate='dubai',
    )


# ─── Model Tests ──────────────────────────────────────────────────────────────

class CompanyModelTest(TestCase):

    def test_tin_auto_derived_from_trn(self):
        company = make_company(trn='123456789012345')
        self.assertEqual(company.tin, '1234567890')

    def test_invalid_trn_raises_validation_error(self):
        from django.core.exceptions import ValidationError
        company = Company(
            name='Bad Co', legal_name='Bad Co',
            trn='ABCDEF123456789',   # Letters not allowed
            street_address='x', city='Dubai', emirate='dubai',
        )
        with self.assertRaises(ValidationError):
            company.full_clean()

    def test_trn_must_be_15_digits(self):
        from django.core.exceptions import ValidationError
        company = Company(
            name='Short Co', legal_name='Short Co',
            trn='12345',   # Too short
            street_address='x', city='Dubai', emirate='dubai',
        )
        with self.assertRaises(ValidationError):
            company.full_clean()

    def test_formatted_address(self):
        company = make_company()
        addr = company.formatted_address
        self.assertIn('Dubai', addr)
        self.assertIn('United Arab Emirates', addr)

    def test_duplicate_trn_raises_integrity_error(self):
        from django.db import IntegrityError
        make_company(trn='100000000000001')
        with self.assertRaises(IntegrityError):
            make_company(trn='100000000000001', name='Duplicate Co')


# ─── Company API Tests ────────────────────────────────────────────────────────

class CompanyCreateAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.client.force_authenticate(user=self.user)
        self.url = '/api/v1/companies/'
        self.valid_payload = {
            'name': 'Alpha Trading LLC',
            'legal_name': 'Alpha Trading LLC',
            'trn': '100000000000001',
            'street_address': 'Sheikh Zayed Road, Tower A',
            'city': 'Dubai',
            'emirate': 'dubai',
            'phone': '+971-4-1234567',
            'email': 'info@alphatrading.ae',
        }

    def test_create_company_returns_201(self):
        response = self.client.post(self.url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['name'], 'Alpha Trading LLC')
        self.assertEqual(response.data['data']['tin'], '1000000000')  # First 10 of TRN

    def test_creator_becomes_admin_member(self):
        self.client.post(self.url, self.valid_payload, format='json')
        company = Company.objects.get(trn='100000000000001')
        membership = CompanyMember.objects.get(company=company, user=self.user)
        self.assertEqual(membership.role, 'admin')

    def test_duplicate_trn_returns_400(self):
        self.client.post(self.url, self.valid_payload, format='json')
        response = self.client.post(self.url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_trn_returns_400(self):
        payload = {**self.valid_payload, 'trn': 'NOTANUMBER123'}
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class CompanyDetailAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user(email='admin@test.com', role='admin')
        self.viewer = make_user(email='viewer@test.com', role='viewer')
        self.outsider = make_user(email='outsider@test.com')
        self.company = make_company()
        CompanyMember.objects.create(company=self.company, user=self.admin, role='admin')
        CompanyMember.objects.create(company=self.company, user=self.viewer, role='viewer')

    def test_member_can_get_company(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.get(f'/api/v1/companies/{self.company.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_member_gets_404(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f'/api/v1/companies/{self.company.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_update_company(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            f'/api/v1/companies/{self.company.id}/',
            {'name': 'Updated Name'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['name'], 'Updated Name')

    def test_viewer_cannot_update_company(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.put(
            f'/api/v1/companies/{self.company.id}/',
            {'name': 'Hacked Name'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ─── Member Management Tests ──────────────────────────────────────────────────

class MemberManagementAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user(email='admin@test.com')
        self.new_user = make_user(email='newuser@test.com')
        self.company = make_company()
        self.membership = CompanyMember.objects.create(
            company=self.company, user=self.admin, role='admin'
        )
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_add_member(self):
        response = self.client.post(
            f'/api/v1/companies/{self.company.id}/members/',
            {'user_email': self.new_user.email, 'role': 'accountant'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            CompanyMember.objects.filter(company=self.company, user=self.new_user).exists()
        )

    def test_cannot_add_nonexistent_user(self):
        response = self.client.post(
            f'/api/v1/companies/{self.company.id}/members/',
            {'user_email': 'ghost@test.com', 'role': 'viewer'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_remove_only_admin(self):
        response = self.client.delete(
            f'/api/v1/companies/{self.company.id}/members/{self.membership.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_member_role(self):
        m = CompanyMember.objects.create(
            company=self.company, user=self.new_user, role='viewer'
        )
        response = self.client.put(
            f'/api/v1/companies/{self.company.id}/members/{m.id}/',
            {'role': 'accountant'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        m.refresh_from_db()
        self.assertEqual(m.role, 'accountant')
