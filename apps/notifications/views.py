"""
Notification API.

  GET  /api/v1/notifications/            list (recent) + unread_count
  POST /api/v1/notifications/<id>/read/  mark one as read
  POST /api/v1/notifications/read-all/   mark all as read
"""
from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response
from .models import Notification
from .serializers import NotificationSerializer

# How many recent notifications the bell dropdown loads.
_RECENT_LIMIT = 20
# Notifications are valid for 1 day; older ones are hidden (and cleaned up daily).
_VALID_DAYS = 1


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cutoff = timezone.now() - timedelta(days=_VALID_DAYS)
        qs = Notification.objects.filter(user=request.user, created_at__gte=cutoff)
        unread_count = qs.filter(is_read=False).count()
        recent = qs[:_RECENT_LIMIT]
        return success_response(data={
            'unread_count': unread_count,
            'results': NotificationSerializer(recent, many=True).data,
        })


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        n = get_object_or_404(Notification, id=pk, user=request.user)
        if not n.is_read:
            n.is_read = True
            n.save(update_fields=['is_read'])
        return success_response(message='Marked as read.')


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return success_response(message='All notifications marked as read.')
