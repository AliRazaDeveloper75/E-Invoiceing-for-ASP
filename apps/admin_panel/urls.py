"""
Admin Panel URL configuration.
Mounted at: /api/v1/admin/ in config/urls.py
All routes require role='admin'.
"""
from django.urls import path
from .views import (
    AdminStatsView,
    AdminUserListView,
    AdminUserDetailView,
    AdminUserActivateView,
    AdminUserDeactivateView,
    AdminInvoiceListView,
    AdminInvoiceDetailView,
    AdminInvoiceSubmitView,
    AdminInvoiceApproveASPView,
    AdminInvoiceRejectASPView,
    AdminInvoiceReportFTAView,
    AdminInvoiceTimelineView,
)

app_name = 'admin_panel'

urlpatterns = [
    # ── Stats ─────────────────────────────────────────────────────────────────
    path('stats/',                                  AdminStatsView.as_view(),           name='stats'),

    # ── User Management ───────────────────────────────────────────────────────
    path('users/',                                  AdminUserListView.as_view(),         name='user-list'),
    path('users/<uuid:pk>/',                        AdminUserDetailView.as_view(),       name='user-detail'),
    path('users/<uuid:pk>/activate/',               AdminUserActivateView.as_view(),     name='user-activate'),
    path('users/<uuid:pk>/deactivate/',             AdminUserDeactivateView.as_view(),   name='user-deactivate'),

    # ── Invoice Management ────────────────────────────────────────────────────
    path('invoices/',                               AdminInvoiceListView.as_view(),      name='invoice-list'),
    path('invoices/<uuid:pk>/',                     AdminInvoiceDetailView.as_view(),    name='invoice-detail'),
    path('invoices/<uuid:pk>/submit/',              AdminInvoiceSubmitView.as_view(),    name='invoice-submit'),
    path('invoices/<uuid:pk>/approve-asp/',         AdminInvoiceApproveASPView.as_view(),name='invoice-approve-asp'),
    path('invoices/<uuid:pk>/reject-asp/',          AdminInvoiceRejectASPView.as_view(), name='invoice-reject-asp'),
    path('invoices/<uuid:pk>/report-fta/',          AdminInvoiceReportFTAView.as_view(), name='invoice-report-fta'),
    path('invoices/<uuid:pk>/timeline/',            AdminInvoiceTimelineView.as_view(),  name='invoice-timeline'),
]
