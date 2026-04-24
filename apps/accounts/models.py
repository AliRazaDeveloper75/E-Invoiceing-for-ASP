"""
Custom User model for UAE E-Invoicing SaaS platform.

Design decisions:
- Email as the login identifier (no username field)
- UUID primary key (prevents ID enumeration)
- Role field for platform-level access control (Admin / Accountant / Viewer)
- Company association handled in companies app via CompanyMember
  (avoids circular imports; one user can belong to multiple companies)
"""
import uuid
import random
from datetime import timedelta
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone

from apps.common.constants import USER_ROLE_CHOICES, ROLE_SUPPLIER, ROLE_INBOUND_SUPPLIER


class UserManager(BaseUserManager):
    """
    Custom manager: uses email instead of username.
    """

    def create_user(self, email: str, password: str, **extra_fields):
        """Create and save a regular user."""
        if not email:
            raise ValueError('Email address is required.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **extra_fields):
        """Create a Django admin superuser."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'admin')

        if not extra_fields.get('is_staff'):
            raise ValueError('Superuser must have is_staff=True.')
        if not extra_fields.get('is_superuser'):
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Platform user.

    Roles (platform-level):
      admin       — full access: users, inbound, ASP/FTA management panel
      supplier    — create & submit own outbound invoices only (no inbound)
      accountant  — legacy alias for supplier (same permissions)
      viewer      — read-only access across all resources

    Multi-company:
      User <-> Company relationship (with role) lives in CompanyMember
      model inside the companies app. A user can belong to multiple companies.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text='Primary login identifier.'
    )
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    role = models.CharField(
        max_length=20,
        choices=USER_ROLE_CHOICES,
        default=ROLE_SUPPLIER,
        db_index=True,
        help_text='Platform-level default role. Per-company role is in CompanyMember.'
    )

    email_verified = models.BooleanField(
        default=False,
        help_text='True once the user has clicked the email verification link.'
    )

    # ── MFA (Google Authenticator TOTP) ───────────────────────────────────────
    mfa_enabled = models.BooleanField(
        default=False,
        help_text='True when TOTP-based MFA is active for this account.'
    )
    mfa_secret = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text='Base32 TOTP secret. Populated during MFA setup, retained after enable.'
    )

    # Django internals
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(
        default=False,
        help_text='Grants access to the Django admin site.'
    )
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UserManager()

    class Meta:
        db_table = 'accounts_users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-date_joined']

    def __str__(self):
        return f'{self.full_name} <{self.email}>'

    @property
    def full_name(self) -> str:
        return f'{self.first_name} {self.last_name}'.strip()

    @property
    def is_admin(self) -> bool:
        return self.role == 'admin'

    @property
    def is_supplier(self) -> bool:
        return self.role in ('supplier', 'accountant')

    @property
    def is_accountant(self) -> bool:
        """Legacy alias for is_supplier."""
        return self.is_supplier

    @property
    def is_viewer(self) -> bool:
        return self.role == 'viewer'

    @property
    def is_inbound_supplier(self) -> bool:
        return self.role == ROLE_INBOUND_SUPPLIER


class MFALoginToken(models.Model):
    """
    Short-lived token issued after password-correct login when MFA is enabled.
    The user must submit a valid TOTP code against this token to receive JWT tokens.
    Expires in 5 minutes; locked after 5 failed attempts.
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='mfa_login_tokens'
    )
    token      = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    attempts   = models.PositiveSmallIntegerField(default=0)
    used       = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_mfa_login_tokens'

    @classmethod
    def create_for_user(cls, user):
        cls.objects.filter(user=user, used=False).delete()
        return cls.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_locked(self):
        return self.attempts >= 5


class EmailVerificationToken(models.Model):
    """Single-use token emailed to users to verify their address."""

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='verification_tokens'
    )
    token      = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    code       = models.CharField(max_length=6, default='', db_index=True)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_email_verification_tokens'

    @classmethod
    def _generate_code(cls) -> str:
        return f'{random.randint(0, 999999):06d}'

    @classmethod
    def create_for_user(cls, user):
        cls.objects.filter(user=user, used=False).delete()
        return cls.objects.create(
            user       = user,
            code       = cls._generate_code(),
            expires_at = timezone.now() + timedelta(minutes=15),
        )

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at


class PasswordResetToken(models.Model):
    """Single-use UUID token emailed to users to reset their password."""

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='password_reset_tokens'
    )
    token      = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_password_reset_tokens'

    @classmethod
    def create_for_user(cls, user):
        cls.objects.filter(user=user, used=False).delete()
        return cls.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(minutes=30),
        )

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at
