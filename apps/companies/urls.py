"""
Companies URL configuration.
Mounted at: /api/v1/companies/ in config/urls.py
"""
from django.urls import path
from .views import (
    CompanyListCreateView,
    CompanyDetailView,
    CompanyMemberListView,
    CompanyMemberDetailView,
)

app_name = 'companies'

urlpatterns = [
    # ── Company CRUD ──────────────────────────────────────────────────────────
    path('',
         CompanyListCreateView.as_view(),
         name='company-list-create'),

    path('<uuid:company_id>/',
         CompanyDetailView.as_view(),
         name='company-detail'),

    # ── Member Management ─────────────────────────────────────────────────────
    path('<uuid:company_id>/members/',
         CompanyMemberListView.as_view(),
         name='company-member-list'),

    path('<uuid:company_id>/members/<uuid:member_id>/',
         CompanyMemberDetailView.as_view(),
         name='company-member-detail'),
]
