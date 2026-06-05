"""
Product catalog API views.

Endpoints:
  GET    /api/v1/invoices/products/?company_id=<uuid>   list (global + company items)
  POST   /api/v1/invoices/products/                     create (company-scoped, or global for admin)
  PUT    /api/v1/invoices/products/<uuid>/              update
  DELETE /api/v1/invoices/products/<uuid>/              delete

Scopes:
  - Global items (company=None) are managed by platform admins, visible to all.
  - Company items are managed by that company's users, visible only to them.
"""
import logging
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response, error_response
from .models import Product
from .serializers import ProductSerializer

logger = logging.getLogger(__name__)


def _is_admin(user) -> bool:
    return getattr(user, 'role', None) == 'admin'


class ProductListCreateView(APIView):
    """List products (global + the active company's) and create new ones."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get('company_id')
        # Always include global items; add company items when a company is given.
        q = Q(company__isnull=True)
        if company_id:
            q |= Q(company_id=company_id)
        products = Product.objects.filter(q, is_active=True).order_by('name')
        return success_response(data=ProductSerializer(products, many=True).data)

    def post(self, request):
        serializer = ProductSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid product.', details=serializer.errors,
                                  status_code=status.HTTP_400_BAD_REQUEST)

        company_id = request.data.get('company_id')
        make_global = request.data.get('is_global') in (True, 'true', '1', 1)

        # Only platform admins may create global catalog items.
        if make_global and not _is_admin(request.user):
            return error_response('Only administrators can create global catalog items.',
                                  status_code=status.HTTP_403_FORBIDDEN)

        product = serializer.save(company_id=None if make_global else company_id)
        return success_response(data=ProductSerializer(product).data,
                                message='Product added.', status_code=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    """Update or delete a single catalog product."""
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        return get_object_or_404(Product, id=pk)

    def _can_edit(self, user, product) -> bool:
        # Global items: admin only. Company items: any authenticated company user.
        if product.company_id is None:
            return _is_admin(user)
        return True

    def put(self, request, pk):
        product = self._get(pk)
        if not self._can_edit(request.user, product):
            return error_response('You cannot edit this catalog item.',
                                  status_code=status.HTTP_403_FORBIDDEN)
        serializer = ProductSerializer(product, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response('Invalid product.', details=serializer.errors,
                                  status_code=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return success_response(data=serializer.data, message='Product updated.')

    def delete(self, request, pk):
        product = self._get(pk)
        if not self._can_edit(request.user, product):
            return error_response('You cannot delete this catalog item.',
                                  status_code=status.HTTP_403_FORBIDDEN)
        product.is_active = False
        product.save(update_fields=['is_active', 'updated_at'])
        return success_response(message='Product removed.')
