"""
Workflow Automation API Views.

POST /api/v1/invoices/<uuid>/workflow/evaluate/ — evaluate workflow action
GET  /api/v1/invoices/<uuid>/workflow/          — get last workflow decision
"""
import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.utils import success_response, error_response
from .models import Invoice

logger = logging.getLogger(__name__)


class WorkflowEvaluateView(APIView):
    """
    POST /api/v1/invoices/<uuid>/workflow/evaluate/
    Run workflow evaluation synchronously and return the decision.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, invoice_pk):
        invoice = get_object_or_404(
            Invoice.objects.select_related('company', 'customer'),
            id=invoice_pk,
            company__in=request.user.companies.filter(is_active=True),
            is_active=True,
        )

        try:
            from services.ai.workflow_service import WorkflowService
            svc = WorkflowService()
            decision = svc.evaluate(invoice)
        except Exception as exc:
            logger.exception('Workflow evaluation failed for invoice %s', invoice_pk)
            return error_response('Workflow evaluation failed.',
                                  status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return success_response(
            data=decision.to_dict(),
            message=f'Workflow action: {decision.action}',
        )
