"""
Accounts API views.

Rules followed:
- Views are thin: validate input → call service → return response
- No business logic here
- All responses use the standard success/error envelope from common.utils
"""
import logging
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError, PermissionDenied
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.utils import success_response, error_response
from .serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    UserUpdateSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    MFAVerifyLoginSerializer,
    MFACodeSerializer,
)
from .services import AuthService, MFAService

logger = logging.getLogger(__name__)


def _issue_tokens(user):
    """Create a JWT pair with custom claims for the given user."""
    refresh = RefreshToken.for_user(user)
    refresh['email']          = user.email
    refresh['full_name']      = user.full_name
    refresh['role']           = user.role
    refresh['email_verified'] = user.email_verified
    return str(refresh.access_token), str(refresh)


# ─── Auth ─────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    """
    POST /api/v1/auth/register/

    Register a new user. Returns JWT tokens on success.
    No authentication required.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Registration failed.',
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        try:
            user = AuthService.register_user(
                email=data['email'],
                password=data['password'],
                first_name=data['first_name'],
                last_name=data['last_name'],
                role=data.get('role', 'supplier'),
            )
        except DRFValidationError as exc:
            details = exc.detail if isinstance(exc.detail, dict) else {'error': exc.detail}
            return error_response(
                message='Registration failed.',
                details=details,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        AuthService.send_verification_email(user)

        access, refresh = _issue_tokens(user)
        return success_response(
            data={
                'user': UserSerializer(user).data,
                'tokens': {'access': access, 'refresh': refresh},
            },
            message='Registration successful.',
            status_code=status.HTTP_201_CREATED
        )


class LoginView(APIView):
    """
    POST /api/v1/auth/login/

    Step 1 of the login flow.
    - If MFA is disabled: returns JWT tokens directly.
    - If MFA is enabled:  returns mfa_required=true + a short-lived mfa_token.
      The client must then POST to /auth/mfa/verify-login/ to get JWT tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate
        from apps.accounts.models import MFALoginToken

        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                'Invalid input.',
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(
            request,
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )
        if user is None:
            return error_response(
                'No active account found with the given credentials.',
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.email_verified:
            return error_response(
                'Email not verified. Please verify your email before signing in.',
                details={'code': 'EMAIL_NOT_VERIFIED'},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if user.mfa_enabled:
            mfa_record = MFALoginToken.create_for_user(user)
            return success_response(
                data={'mfa_required': True, 'mfa_token': str(mfa_record.token)},
                message='MFA verification required.',
            )

        access, refresh = _issue_tokens(user)
        return success_response(
            data={
                'mfa_required': False,
                'access': access,
                'refresh': refresh,
                'user': UserSerializer(user).data,
            },
            message='Login successful.',
        )


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/

    Blacklists the refresh token, effectively logging the user out.
    Requires the refresh token in the request body.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return error_response(
                message='Refresh token is required.',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass

        return success_response(message='Logged out successfully.')


class TokenRefreshAPIView(TokenRefreshView):
    """
    POST /api/v1/auth/token/refresh/

    Standard simplejwt token refresh. Returns a new access token.
    """
    pass


# ─── Profile ──────────────────────────────────────────────────────────────────

class UserProfileView(APIView):
    """
    GET  /api/v1/auth/me/  — Return current user's profile
    PUT  /api/v1/auth/me/  — Update first_name / last_name
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return success_response(data=serializer.data)

    def put(self, request):
        serializer = UserUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Profile update failed.',
                details=serializer.errors
            )

        user = AuthService.update_profile(
            user=request.user,
            first_name=serializer.validated_data.get('first_name'),
            last_name=serializer.validated_data.get('last_name'),
        )
        return success_response(
            data=UserSerializer(user).data,
            message='Profile updated successfully.'
        )


class ChangePasswordView(APIView):
    """
    POST /api/v1/auth/change-password/

    Requires old password verification before setting a new one.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Password change failed.',
                details=serializer.errors
            )

        data = serializer.validated_data
        try:
            AuthService.change_password(
                user=request.user,
                old_password=data['old_password'],
                new_password=data['new_password'],
            )
        except (DRFValidationError, PermissionDenied) as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
            return error_response(str(msg), status_code=400)
        return success_response(message='Password changed successfully.')


class VerifyEmailView(APIView):
    """POST /api/v1/auth/verify-email/  { code: str }"""
    permission_classes = [AllowAny]

    def post(self, request):
        code = request.data.get('code', '').strip()
        if not code:
            return error_response('Verification code is required.', status_code=400)
        try:
            user = AuthService.verify_email(code)
        except DRFValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
            return error_response(str(msg), status_code=400)
        return success_response(
            data={'email': user.email, 'email_verified': True},
            message='Email verified successfully.',
        )


class ResendVerificationView(APIView):
    """POST /api/v1/auth/resend-verification/  { email: str }"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return error_response('Email is required.', status_code=400)
        AuthService.resend_verification(email)
        return success_response(
            message='If that email is registered and unverified, a new link has been sent.'
        )


class ForgotPasswordView(APIView):
    """POST /api/v1/auth/forgot-password/  { email: str }"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return error_response('Email is required.', status_code=400)
        AuthService.send_password_reset_email(email)
        return success_response(
            message='If that email is registered, a password reset link has been sent.'
        )


class ResetPasswordView(APIView):
    """POST /api/v1/auth/reset-password/  { token: str, new_password: str }"""
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token', '').strip()
        new_password = request.data.get('new_password', '')
        if not token or not new_password:
            return error_response('Token and new password are required.', status_code=400)
        try:
            AuthService.reset_password(token, new_password)
        except DRFValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
            return error_response(str(msg), status_code=400)
        return success_response(message='Password reset successful. You can now sign in.')


# ─── MFA ──────────────────────────────────────────────────────────────────────

class MFAVerifyLoginView(APIView):
    """
    POST /api/v1/auth/mfa/verify-login/  { mfa_token: uuid, code: str }

    Step 2 of MFA login. Verifies the TOTP code against the pending
    MFALoginToken and, on success, returns JWT tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = MFAVerifyLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid input.', details=serializer.errors, status_code=400)

        try:
            user = MFAService.verify_login(
                mfa_token_str=str(serializer.validated_data['mfa_token']),
                code=serializer.validated_data['code'],
            )
        except DRFValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
            return error_response(str(msg), status_code=400)

        access, refresh = _issue_tokens(user)
        return success_response(
            data={
                'access': access,
                'refresh': refresh,
                'user': UserSerializer(user).data,
            },
            message='Login successful.',
        )


class MFASetupView(APIView):
    """
    POST /api/v1/auth/mfa/setup/

    Generates a new TOTP secret and returns a QR provisioning URI.
    MFA is NOT active yet — the user must call /mfa/enable/ to confirm.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        result = MFAService.setup(request.user)
        return success_response(data=result)


class MFAEnableView(APIView):
    """
    POST /api/v1/auth/mfa/enable/  { code: str }

    Verifies the TOTP code against the pending secret and activates MFA.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MFACodeSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid input.', details=serializer.errors, status_code=400)

        try:
            MFAService.enable(request.user, serializer.validated_data['code'])
        except DRFValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
            return error_response(str(msg), status_code=400)

        return success_response(message='Two-factor authentication enabled.')


class MFADisableView(APIView):
    """
    POST /api/v1/auth/mfa/disable/  { code: str }

    Verifies the current TOTP code then deactivates MFA and wipes the secret.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MFACodeSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid input.', details=serializer.errors, status_code=400)

        try:
            MFAService.disable(request.user, serializer.validated_data['code'])
        except DRFValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
            return error_response(str(msg), status_code=400)

        return success_response(message='Two-factor authentication disabled.')


class MFAStatusView(APIView):
    """GET /api/v1/auth/mfa/status/  — returns whether MFA is enabled for the current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(data={'mfa_enabled': request.user.mfa_enabled})
