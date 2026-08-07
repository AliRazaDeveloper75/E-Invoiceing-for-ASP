"""
Onboarding app tests.

Covers upload-safety on the public invite-accept flow:
- disguised / non-PDF verification documents rejected via magic-byte check
- valid documents accepted
"""
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from .models import CompanyInvitation


def make_invite():
    return CompanyInvitation.objects.create(
        email='vendor@test.com',
        first_name='Vendor',
        last_name='Co',
        role='supplier',
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )


class AcceptInviteDocumentValidationTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.invite = make_invite()
        self.url = '/api/v1/onboarding/invite/accept/'
        self.base = {
            'token': str(self.invite.token),
            'first_name': 'Vendor',
            'last_name': 'Co',
            'password': 'StrongPass123!',
            'confirm_password': 'StrongPass123!',
            'company_name': 'Vendor Co LLC',
            'trn': '100000000000003',
            'trade_license_number': 'DED-2024-12345',
        }

    def make_doc(self, content, name='trn.pdf', content_type='application/pdf'):
        return SimpleUploadedFile(name, content, content_type=content_type)

    def test_disguised_document_rejected(self):
        payload = {
            **self.base,
            'doc_0_file': self.make_doc(b'plain text, not a real pdf'),
            'doc_0_type': 'trn_certificate',
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('doc_0_file', response.data['error']['details'])

    def test_valid_pdf_document_accepted(self):
        payload = {
            **self.base,
            'doc_0_file': self.make_doc(b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),
            'doc_0_type': 'trn_certificate',
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CompanyInvitation.objects.get(pk=self.invite.pk).status, 'accepted')


class InvitationCreateValidationTest(TestCase):
    """One email = one role: invitations must not target an email that already owns an account."""

    def setUp(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        self.admin = User.objects.create_user(
            email='admin@co.com', password='Pass123!', role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.url = '/api/v1/onboarding/invitations/'

    def post(self, email, role='supplier'):
        return self.client.post(self.url, {'email': email, 'role': role})

    def test_invite_rejected_when_email_already_has_account(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        User.objects.create_user(
            email='taken@co.com', password='Pass123!', role='supplier',
        )
        response = self.post('taken@co.com')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(CompanyInvitation.objects.count(), 0)

    def test_invite_rejected_when_pending_invite_has_different_role(self):
        CompanyInvitation.objects.create(
            email='vendor@co.com', role='buyer',
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )
        response = self.post('vendor@co.com', role='supplier')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn('different role', response.data['error']['message'].lower())
        self.assertEqual(
            CompanyInvitation.objects.filter(email='vendor@co.com', status='pending').count(), 1,
        )

    def test_same_role_reinvite_expires_old_pending_invite(self):
        CompanyInvitation.objects.create(
            email='vendor@co.com', role='supplier',
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )
        with self.settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
            response = self.post('vendor@co.com', role='supplier')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(
            CompanyInvitation.objects.filter(email='vendor@co.com', status='pending').count(), 1,
        )
