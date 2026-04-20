"""
Accounts API views.

Rules followed:
- Views are thin: validate input → call service → return response
- No business logic here
- All responses use the standard success/error envelope from common.utils
"""
import logging
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.utils import success_response, error_response
from .serializers import (
    UserRegistrationSerializer,
    CustomTokenObtainPairSerializer,
    UserSerializer,
    UserUpdateSerializer,
    ChangePasswordSerializer,
)
from .services import AuthService

logger = logging.getLogger(__name__)


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

        # Send verification email (non-blocking — failure doesn't abort registration)
        AuthService.send_verification_email(user)

        # Issue JWT tokens immediately after registration
        refresh = RefreshToken.for_user(user)
        return success_response(
            data={
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
            },
            message='Registration successful.',
            status_code=status.HTTP_201_CREATED
        )


class LoginView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/

    Returns access + refresh JWT tokens with custom claims (role, full_name).
    Uses CustomTokenObtainPairSerializer configured in settings.SIMPLE_JWT.
    """
    serializer_class = CustomTokenObtainPairSerializer


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
            # Token already invalid or expired — treat as already logged out
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
        AuthService.change_password(
            user=request.user,
            old_password=data['old_password'],
            new_password=data['new_password'],
        )
        return success_response(message='Password changed successfully.')


class VerifyEmailView(APIView):
    """POST /api/v1/auth/verify-email/  { token: uuid }"""
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
