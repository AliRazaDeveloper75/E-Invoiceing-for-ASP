from django.urls import path
from .views import (
    ValidateInviteTokenView,
    AcceptInviteView,
    TrackEmailOpenView,
    InvitationListCreateView,
    InvitationDetailView,
    ResendInvitationView,
    OnboardingReviewListView,
    OnboardingReviewDetailView,
    OnboardingDocumentListView,
)

app_name = 'onboarding'

urlpatterns = [
    # Public
    path('invite/validate/',              ValidateInviteTokenView.as_view(),   name='invite-validate'),
    path('invite/accept/',                AcceptInviteView.as_view(),          name='invite-accept'),
    path('invite/open/',                  TrackEmailOpenView.as_view(),        name='invite-open-track'),

    # Admin — invitations
    path('invitations/',                        InvitationListCreateView.as_view(), name='invitations'),
    path('invitations/<uuid:invitation_id>/',   InvitationDetailView.as_view(),     name='invitation-detail'),
    path('invitations/<uuid:invitation_id>/resend/', ResendInvitationView.as_view(), name='invitation-resend'),

    # Admin — review
    path('review/',                        OnboardingReviewListView.as_view(),    name='review-list'),
    path('review/<uuid:company_id>/',      OnboardingReviewDetailView.as_view(),  name='review-detail'),
    path('review/<uuid:company_id>/docs/', OnboardingDocumentListView.as_view(),  name='review-docs'),
]
