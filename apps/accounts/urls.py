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
]
