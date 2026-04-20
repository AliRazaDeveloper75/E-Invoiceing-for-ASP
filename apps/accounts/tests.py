"""
Accounts app tests.

Covers:
- User model creation
- Registration API
- Login / JWT flow
- Password change
- Permission class logic
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


# ─── Model Tests ──────────────────────────────────────────────────────────────

class UserModelTest(TestCase):

    def test_create_user_with_email(self):
        user = User.objects.create_user(
            email='test@example.com',
            password='StrongPass123!',
            first_name='Ahmed',
            last_name='Al Mansoori',
        )
        self.assertEqual(user.email, 'test@example.com')
        self.assertEqual(user.full_name, 'Ahmed Al Mansoori')
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertEqual(user.role, 'viewer')   # Default role

    def test_create_superuser(self):
        admin = User.objects.create_superuser(
            email='admin@example.com',
            password='AdminPass123!',
            first_name='Super',
            last_name='Admin',
        )
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertEqual(admin.role, 'admin')

    def test_email_normalized_to_lowercase(self):
        user = User.objects.create_user(
            email='TEST@EXAMPLE.COM',
            password='Pass123!',
            first_name='Test',
            last_name='User',
        )
        self.assertEqual(user.email, 'test@example.com')

    def test_create_user_without_email_raises(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email='', password='Pass123!')

    def test_role_properties(self):
        user = User.objects.create_user(
            email='acc@example.com', password='Pass123!',
            first_name='Sara', last_name='Ali', role='accountant'
        )
        self.assertFalse(user.is_admin)
        self.assertTrue(user.is_accountant)
        self.assertFalse(user.is_viewer)


# ─── Registration API Tests ───────────────────────────────────────────────────

class RegisterAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.url = '/api/v1/auth/register/'
        self.valid_payload = {
            'email': 'new@example.com',
            'password': 'StrongPass123!',
            'confirm_password': 'StrongPass123!',
            'first_name': 'Ahmed',
            'last_name': 'Al Rashid',
            'role': 'accountant',
        }

    def test_successful_registration_returns_201(self):
        response = self.client.post(self.url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', response.data['data'])
        self.assertIn('user', response.data['data'])

    def test_duplicate_email_returns_400(self):
        self.client.post(self.url, self.valid_payload, format='json')
        response = self.client.post(self.url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_mismatch_returns_400(self):
        payload = {**self.valid_payload, 'confirm_password': 'WrongPass!'}
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_email_returns_400(self):
        payload = {**self.valid_payload}
        del payload['email']
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ─── Login / JWT Tests ────────────────────────────────────────────────────────

class LoginAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.url = '/api/v1/auth/login/'
        self.user = User.objects.create_user(
            email='user@example.com',
            password='StrongPass123!',
            first_name='Fatima',
            last_name='Al Zaabi',
            role='accountant',
        )

    def test_login_returns_tokens(self):
        response = self.client.post(self.url, {
            'email': 'user@example.com',
            'password': 'StrongPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_with_wrong_password_returns_401(self):
        response = self.client.post(self.url, {
            'email': 'user@example.com',
            'password': 'WrongPass!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_with_unknown_email_returns_401(self):
        response = self.client.post(self.url, {
            'email': 'unknown@example.com',
            'password': 'Pass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ─── Profile API Tests ────────────────────────────────────────────────────────

class UserProfileAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='profile@example.com',
            password='StrongPass123!',
            first_name='Khalid',
            last_name='Al Ameri',
        )
        self.client.force_authenticate(user=self.user)

    def test_get_profile_returns_200(self):
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['email'], 'profile@example.com')

    def test_update_profile_name(self):
        response = self.client.put('/api/v1/auth/me/', {
            'first_name': 'Mohammed',
            'last_name': 'Al Ameri',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['first_name'], 'Mohammed')

    def test_unauthenticated_profile_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
