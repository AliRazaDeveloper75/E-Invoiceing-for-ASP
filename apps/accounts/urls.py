"""
Accounts URL configuration.
Mounted at: /api/v1/auth/ in config/urls.py
"""
from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    TokenRefreshAPIView,
    UserProfileView,
    ChangePasswordView,
    VerifyEmailView,
    ResendVerificationView,
    ForgotPasswordView,
    ResetPasswordView,
    MFAVerifyLoginView,
    MFASetupLoginView,
    MFAEnableLoginView,
    MFASetupView,
    MFAEnableView,
    MFADisableView,
    MFAStatusView,
)

app_name = 'accounts'

urlpatterns = [
    # ── Authentication ────────────────────────────────────────────────────────
    path('register/',        RegisterView.as_view(),        name='register'),
    path('login/',           LoginView.as_view(),            name='login'),
    path('logout/',          LogoutView.as_view(),           name='logout'),
    path('token/refresh/',   TokenRefreshAPIView.as_view(),  name='token-refresh'),

    # ── User Profile ──────────────────────────────────────────────────────────
    path('me/',              UserProfileView.as_view(),      name='profile'),
    path('change-password/', ChangePasswordView.as_view(),   name='change-password'),

    # ── Email Verification ────────────────────────────────────────────────────
    path('verify-email/',        VerifyEmailView.as_view(),        name='verify-email'),
    path('resend-verification/', ResendVerificationView.as_view(), name='resend-verification'),

    # ── Password Reset ────────────────────────────────────────────────────────
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/',  ResetPasswordView.as_view(),  name='reset-password'),

    # ── MFA — login-time flows ────────────────────────────────────────────────
    path('mfa/verify-login/',  MFAVerifyLoginView.as_view(),  name='mfa-verify-login'),
    path('mfa/setup-login/',   MFASetupLoginView.as_view(),   name='mfa-setup-login'),
    path('mfa/enable-login/',  MFAEnableLoginView.as_view(),  name='mfa-enable-login'),

    # ── MFA — account settings ────────────────────────────────────────────────
    path('mfa/setup/',   MFASetupView.as_view(),   name='mfa-setup'),
    path('mfa/enable/',  MFAEnableView.as_view(),  name='mfa-enable'),
    path('mfa/disable/', MFADisableView.as_view(), name='mfa-disable'),
    path('mfa/status/',  MFAStatusView.as_view(),  name='mfa-status'),
]
