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
from django.utils import timezone
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
        self.assertEqual(user.role, 'supplier')   # Default role

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

    def test_email_domain_normalized_to_lowercase(self):
        user = User.objects.create_user(
            email='test@EXAMPLE.COM',
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
    """Public self-registration is closed — users join via invitation only."""

    def setUp(self):
        self.client = APIClient()
        self.url = '/api/v1/auth/register/'
        self.valid_payload = {
            'email': 'new@example.com',
            'password': 'StrongPass123!',
            'confirm_password': 'StrongPass123!',
            'first_name': 'Ahmed',
            'last_name': 'Al Rashid',
            'role': 'admin',
        }

    def test_registration_is_closed_403(self):
        response = self.client.post(self.url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_user_created(self):
        self.client.post(self.url, self.valid_payload, format='json')
        self.assertEqual(User.objects.count(), 0)

    def test_admin_role_in_payload_still_rejected(self):
        response = self.client.post(self.url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(role='admin').exists())

    def test_registration_is_closed_without_any_payload(self):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AdminUserCreationTest(TestCase):
    """Admin panel is the only way to create platform admins — it must keep working."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='root@test.com', password='StrongPass123!',
            first_name='Root', last_name='Admin', role='admin',
        )

    def test_admin_can_create_admin_via_admin_panel(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/v1/admin/users/', {
            'email': 'newadmin@test.com', 'password': 'StrongPass123!',
            'first_name': 'New', 'last_name': 'Admin', 'role': 'admin',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email='newadmin@test.com', role='admin').exists())

    def test_admin_can_change_role_via_admin_panel(self):
        user = User.objects.create_user(
            email='member@test.com', password='StrongPass123!',
            first_name='M', last_name='R', role='viewer',
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(f'/api/v1/admin/users/{user.id}/', {
            'role': 'admin',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.role, 'admin')

    def test_non_admin_cannot_create_user(self):
        user = User.objects.create_user(
            email='buyer@test.com', password='StrongPass123!',
            first_name='B', last_name='U', role='buyer',
        )
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/admin/users/', {
            'email': 'x@test.com', 'password': 'StrongPass123!',
            'first_name': 'X', 'last_name': 'Y', 'role': 'admin',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


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
            email_verified=True,
            mfa_enabled=True,
            mfa_verified_at=timezone.now(),
        )

    def test_login_returns_tokens(self):
        response = self.client.post(self.url, {
            'email': 'user@example.com',
            'password': 'StrongPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data['data'])
        self.assertIn('refresh', response.data['data'])

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
