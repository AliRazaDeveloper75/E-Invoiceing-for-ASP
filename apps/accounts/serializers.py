"""
Accounts serializers.

Responsibilities:
- Input validation (field-level)
- Serialization of User model to JSON
- Custom JWT claims (role injected into token payload)

No business logic here — that lives in services.py.
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.common.constants import USER_ROLE_CHOICES

User = get_user_model()


# ─── JWT ──────────────────────────────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default JWT payload with user role and full name.
    Frontend can read role from the token without an extra API call.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Custom claims injected into JWT payload
        token['email']          = user.email
        token['full_name']      = user.full_name
        token['role']           = user.role
        token['email_verified'] = user.email_verified

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Append user data alongside the tokens for convenience
        data['user'] = UserSerializer(self.user).data
        return data


# ─── Registration ─────────────────────────────────────────────────────────────

class UserRegistrationSerializer(serializers.Serializer):
    """
    Validates registration input.
    Does NOT call User.objects.create directly — delegates to AuthService.
    """
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    confirm_password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(
        choices=USER_ROLE_CHOICES,
        default='supplier',
        required=False
    )

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs


# ─── Profile ──────────────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    """Read-only user representation. Used in API responses and JWT payload."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'is_active',
            'email_verified',
            'mfa_enabled',
            'date_joined',
        ]
        read_only_fields = ['id', 'email', 'is_active', 'email_verified', 'mfa_enabled', 'date_joined']

    def get_full_name(self, obj) -> str:
        return obj.full_name


class UserUpdateSerializer(serializers.Serializer):
    """Only first_name and last_name are self-editable."""
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('At least one field must be provided.')
        return attrs


# ─── Password ─────────────────────────────────────────────────────────────────

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    confirm_new_password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_new_password']:
            raise serializers.ValidationError(
                {'confirm_new_password': 'New passwords do not match.'}
            )
        return attrs


# ─── MFA / Login ──────────────────────────────────────────────────────────────

class LoginSerializer(serializers.Serializer):
    """Credentials for the custom login endpoint."""
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class MFAVerifyLoginSerializer(serializers.Serializer):
    """Token + TOTP code submitted on the MFA challenge page."""
    mfa_token = serializers.UUIDField()
    code      = serializers.CharField(min_length=6, max_length=6)


class MFACodeSerializer(serializers.Serializer):
    """Single TOTP code — used to enable or disable MFA from settings."""
    code = serializers.CharField(min_length=6, max_length=6)


class MFASetupLoginSerializer(serializers.Serializer):
    """setup_token proves the user passed password auth and needs to set up MFA."""
    setup_token = serializers.UUIDField()


class MFAEnableLoginSerializer(serializers.Serializer):
    """Confirm TOTP code during forced setup, then receive JWT tokens."""
    setup_token = serializers.UUIDField()
    code        = serializers.CharField(min_length=6, max_length=6)
