"""
Notification API tests.

Covers:
- Buyer list endpoint hides the buyer's own action events (created / viewed /
  approved / rejected) and only exposes external invoice/payment events.
- Non-buyer roles are not filtered.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.common.constants import ROLE_BUYER
from .models import Notification

User = get_user_model()


def make_user(email='u@t.com', role='admin'):
    return User.objects.create_user(
        email=email, password='Pass123!', first_name='Test', last_name='User',
        role=role,
    )


class BuyerNotificationListFilterTest(TestCase):

    def setUp(self):
        self.buyer = make_user(email='buyer@t.com', role=ROLE_BUYER)
        self.admin = make_user(email='admin@t.com', role='admin')
        self.client = APIClient()

    def _make(self, user, event):
        return Notification.objects.create(
            user=user, category='invoice', event=event, title=event,
        )

    def test_buyer_sees_only_allowed_events(self):
        allowed = ['invoice_validated', 'payment_received']
        own = ['buyer_created_invoice', 'buyer_viewed', 'buyer_approved', 'buyer_rejected']
        for ev in allowed + own:
            self._make(self.buyer, ev)
        self._make(self.buyer, 'contact_message')

        self.client.force_authenticate(user=self.buyer)
        response = self.client.get('/api/v1/notifications/')

        self.assertEqual(response.status_code, 200, response.data)
        events = {n['event'] for n in response.data['data']['results']}
        self.assertEqual(events, set(allowed))

    def test_buyer_unread_count_excludes_own_events(self):
        self._make(self.buyer, 'invoice_validated')
        self._make(self.buyer, 'buyer_viewed')

        self.client.force_authenticate(user=self.buyer)
        response = self.client.get('/api/v1/notifications/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['data']['unread_count'], 1)

    def test_non_buyer_events_unfiltered(self):
        for ev in ['buyer_viewed', 'invoice_validated', 'contact_message']:
            self._make(self.admin, ev)

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/v1/notifications/')

        self.assertEqual(response.status_code, 200, response.data)
        events = {n['event'] for n in response.data['data']['results']}
        self.assertTrue({'buyer_viewed', 'invoice_validated', 'contact_message'} <= events)
