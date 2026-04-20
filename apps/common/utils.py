"""
Shared utilities: pagination, exception handler, response helpers.
Used by all apps via REST_FRAMEWORK settings.
"""
import logging
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

from .constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

logger = logging.getLogger(__name__)


# ─── Pagination ───────────────────────────────────────────────────────────────

class StandardResultsPagination(PageNumberPagination):
    """
    Standard paginator: ?page=1&page_size=20
    Returns metadata alongside results.
    """
    page_size = DEFAULT_PAGE_SIZE
    page_size_query_param = 'page_size'
    max_page_size = MAX_PAGE_SIZE

    def get_paginated_response(self, data):
        return Response({
            'success': True,
            'pagination': {
                'count': self.page.paginator.count,
                'total_pages': self.page.paginator.num_pages,
                'current_page': self.page.number,
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
            },
            'results': data,
        })


# ─── Exception Handler ────────────────────────────────────────────────────────

def custom_exception_handler(exc, context):
    """
    Wraps all DRF errors in a consistent envelope:

    {
        "success": false,
        "error": {
            "code": 400,
            "message": "Human-readable summary",
            "details": { ... field-level errors ... }
        }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        # Log 5xx errors server-side
        if response.status_code >= 500:
            logger.error(
                'Server error in %s: %s',
                context.get('view', ''),
                exc,
                exc_info=True
            )

        response.data = {
            'success': False,
            'error': {
                'code': response.status_code,
                'message': _extract_message(response.data),
                'details': response.data,
            }
        }

    return response


def _extract_message(data) -> str:
    """Pull a human-readable string from DRF error data."""
    if isinstance(data, dict):
        if 'detail' in data:
            return str(data['detail'])
        for key, val in data.items():
            if isinstance(val, list) and val:
                return f"{key}: {val[0]}"
    if isinstance(data, list) and data:
        return str(data[0])
    return 'An error occurred.'


# ─── Response Helpers ─────────────────────────────────────────────────────────

def success_response(data=None, message='Success', status_code=status.HTTP_200_OK):
    """Standard success envelope for non-paginated responses."""
    payload = {'success': True, 'message': message}
    if data is not None:
        payload['data'] = data
    return Response(payload, status=status_code)


def error_response(message='An error occurred.', details=None, status_code=status.HTTP_400_BAD_REQUEST):
    """Standard error envelope for manual error responses."""
    payload = {
        'success': False,
        'error': {
            'code': status_code,
            'message': message,
        }
    }
    if details is not None:
        payload['error']['details'] = details
    return Response(payload, status=status_code)
