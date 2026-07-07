"""
Notification API.

  GET  /api/v1/notifications/            list (recent) + unread_count
  POST /api/v1/notifications/<id>/read/  mark one as read
  POST /api/v1/notifications/read-all/   mark all as read
"""
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response
from .models import Notification
from .serializers import NotificationSerializer

# How many recent notifications the bell dropdown loads.
_RECENT_LIMIT = 20


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)
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
