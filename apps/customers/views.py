"""
Customers API views.

URL design:
  All customer endpoints require a `company_id` query param (list/create)
  or resolve it from the customer record (detail).

  GET  /api/v1/customers/?company_id={uuid}           — list (filterable)
  POST /api/v1/customers/                             — create
  GET  /api/v1/customers/{id}/?company_id={uuid}      — retrieve
  PUT  /api/v1/customers/{id}/                        — update
  DELETE /api/v1/customers/{id}/                      — soft delete

Membership is verified on every request — users can only access
customers belonging to companies they are members of.
"""
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response, error_response, StandardResultsPagination
from .models import Customer
from .serializers import (
    CustomerSerializer,
    CustomerCreateSerializer,
    CustomerUpdateSerializer,
    CustomerFilterSerializer,
)
from .services import CustomerService
from .permissions import get_company_and_membership

logger = logging.getLogger(__name__)


# ─── Customer List / Create ───────────────────────────────────────────────────

class CustomerListCreateView(APIView):
    """
    GET  /api/v1/customers/?company_id=<uuid>  — paginated list with filters
    POST /api/v1/customers/                     — create customer for a company
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q as _Q

        # ── Admin: list ALL customers across all companies ─────────────────────
        if request.user.role == 'admin':
            qs = Customer.objects.filter(is_active=True).select_related('company').order_by('name')
            company_id = request.query_params.get('company_id', '').strip()
            search      = request.query_params.get('search', '').strip()
            if company_id:
                qs = qs.filter(company_id=company_id)
            if search:
                qs = qs.filter(
                    _Q(name__icontains=search) |
                    _Q(trn__icontains=search) |
                    _Q(email__icontains=search)
                )
            paginator = StandardResultsPagination()
            page = paginator.paginate_queryset(qs, request)
            return paginator.get_paginated_response(CustomerSerializer(page, many=True).data)

        # ── Non-admin: existing company-scoped behaviour ───────────────────────
        filter_serializer = CustomerFilterSerializer(data=request.query_params)
        if not filter_serializer.is_valid():
            return error_response(
                message='Invalid query parameters.',
                details=filter_serializer.errors
            )

        params = filter_serializer.validated_data
        company, membership = get_company_and_membership(
            request.user, params['company_id']
        )
        if not company:
            return error_response(
                message='Company not found or you are not a member.',
                status_code=status.HTTP_404_NOT_FOUND
            )

        customers = CustomerService.get_company_customers(
            company=company,
            search=params.get('search'),
            customer_type=params.get('customer_type'),
            country=params.get('country'),
        )

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(customers, request)
        return paginator.get_paginated_response(CustomerSerializer(page, many=True).data)

    def post(self, request):
        # company_id is expected in the request body
        company_id = request.data.get('company_id')
        if not company_id:
            return error_response(
                message='company_id is required.',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        company, membership = get_company_and_membership(request.user, company_id)
        if not company:
            return error_response(
                message='Company not found or you are not a member.',
                status_code=status.HTTP_404_NOT_FOUND
            )

        serializer = CustomerCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Customer creation failed.',
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        customer = CustomerService.create_customer(
            company=company,
            membership=membership,
            data=serializer.validated_data,
        )
        return success_response(
            data=CustomerSerializer(customer).data,
            message='Customer created successfully.',
            status_code=status.HTTP_201_CREATED
        )


# ─── Customer Detail / Update / Delete ───────────────────────────────────────

class CustomerDetailView(APIView):
    """
    GET    /api/v1/customers/{id}/  — retrieve customer
    PUT    /api/v1/customers/{id}/  — update customer
    DELETE /api/v1/customers/{id}/  — soft delete
    """
    permission_classes = [IsAuthenticated]

    def _resolve(self, request, customer_id: str):
        """
        Resolve customer → company → membership in one shot.
        Returns (customer, membership) or raises error response.
        """
        try:
            customer = Customer.objects.select_related('company').get(
                id=customer_id,
                is_active=True,
            )
        except Customer.DoesNotExist:
            return None, None, error_response(
                message='Customer not found.',
                status_code=status.HTTP_404_NOT_FOUND
            )

        company, membership = get_company_and_membership(
            request.user, customer.company.id
        )
        if not company:
            return None, None, error_response(
                message='Customer not found.',  # Don't leak existence to non-members
                status_code=status.HTTP_404_NOT_FOUND
            )

        return customer, membership, None

    def get(self, request, customer_id):
        customer, _, err = self._resolve(request, customer_id)
        if err:
            return err
        return success_response(data=CustomerSerializer(customer).data)

    def put(self, request, customer_id):
        customer, membership, err = self._resolve(request, customer_id)
        if err:
            return err

        serializer = CustomerUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message='Customer update failed.',
                details=serializer.errors
            )

        customer = CustomerService.update_customer(
            customer=customer,
            membership=membership,
            data=serializer.validated_data,
        )
        return success_response(
            data=CustomerSerializer(customer).data,
            message='Customer updated successfully.'
        )

    def delete(self, request, customer_id):
        customer, membership, err = self._resolve(request, customer_id)
        if err:
            return err

        CustomerService.deactivate_customer(customer, membership)
        return success_response(message='Customer deactivated successfully.')
