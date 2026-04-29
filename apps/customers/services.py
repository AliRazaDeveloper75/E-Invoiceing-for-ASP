"""
Customer service layer.

All business logic lives here. Views are thin wrappers around services.
"""
import logging
from django.db import models as django_models
from django.core.exceptions import ValidationError, PermissionDenied

from apps.companies.models import Company, CompanyMember
from .models import Customer

logger = logging.getLogger(__name__)


class CustomerService:
    """Handles customer creation, updates, search, and soft deletion."""

    # ── CRUD ──────────────────────────────────────────────────────────────────

    @staticmethod
    def create_customer(company: Company, membership: CompanyMember, data: dict) -> Customer:
        """
        Create a customer scoped to a company.

        Only Admin and Accountant roles can create customers.
        Validates that UAE B2B/B2G customers have a TRN.
        """
        if membership.role not in ('admin', 'accountant'):
            raise PermissionDenied('Admin or Accountant role required to create customers.')

        trn = data.get('trn', '').strip()

        # Guard: same TRN cannot be registered twice under the same company
        if trn and Customer.objects.filter(company=company, trn=trn).exists():
            raise ValidationError({
                'trn': f'A customer with TRN {trn} already exists in this company.'
            })

        customer = Customer(
            company=company,
            name=data['name'].strip(),
            legal_name=data.get('legal_name', '').strip(),
            customer_type=data.get('customer_type', 'b2b'),
            trn=trn,
            vat_number=data.get('vat_number', '').strip(),
            peppol_endpoint=data.get('peppol_endpoint', '').strip(),
            street_address=data.get('street_address', '').strip(),
            city=data.get('city', '').strip(),
            state_province=data.get('state_province', '').strip(),
            postal_code=data.get('postal_code', '').strip(),
            country=data.get('country', 'AE').strip().upper(),
            email=data.get('email', '').strip(),
            phone=data.get('phone', '').strip(),
            notes=data.get('notes', '').strip(),
        )

        # Run model-level validation (clean method) before save
        customer.full_clean(exclude=['id', 'created_at', 'updated_at'])
        customer.save()

        logger.info(
            'Customer created: %s (company: %s, type: %s)',
            customer.name, company.name, customer.customer_type
        )
        return customer

    @staticmethod
    def update_customer(
        customer: Customer,
        membership: CompanyMember,
        data: dict,
    ) -> Customer:
        """
        Update a customer record.
        Only Admin and Accountant can update; Viewer is read-only.
        """
        if membership.role not in ('admin', 'accountant'):
            raise PermissionDenied('Admin or Accountant role required to update customers.')

        updatable_fields = [
            'name', 'legal_name', 'customer_type',
            'trn', 'vat_number', 'peppol_endpoint',
            'street_address', 'city', 'state_province', 'postal_code', 'country',
            'email', 'phone', 'notes',
        ]

        # Guard: new TRN must not conflict with another customer in same company
        new_trn = data.get('trn', '').strip()
        if new_trn and new_trn != customer.trn:
            if Customer.objects.filter(company=customer.company, trn=new_trn).exists():
                raise ValidationError({
                    'trn': f'A customer with TRN {new_trn} already exists in this company.'
                })

        changed = []
        for field in updatable_fields:
            if field in data:
                value = data[field]
                if isinstance(value, str):
                    value = value.strip()
                    if field == 'country':
                        value = value.upper()
                setattr(customer, field, value)
                changed.append(field)

        if changed:
            customer.full_clean(exclude=['id', 'created_at', 'updated_at'])
            customer.save(update_fields=changed + ['updated_at'])

        logger.info('Customer updated: %s — fields: %s', customer.name, changed)
        return customer

    @staticmethod
    def deactivate_customer(customer: Customer, membership: CompanyMember) -> Customer:
        """Soft-delete a customer. Only Admin can deactivate."""
        if not membership.is_admin:
            raise PermissionDenied('Only company admins can deactivate customers.')

        customer.is_active = False
        customer.save(update_fields=['is_active', 'updated_at'])
        logger.warning('Customer deactivated: %s (company: %s)', customer.name, customer.company.name)
        return customer

    # ── Queries ───────────────────────────────────────────────────────────────

    @staticmethod
    def get_company_customers(
        company: Company,
        search: str = None,
        customer_type: str = None,
        country: str = None,
        active_only: bool = True,
    ):
        """
        Return customers for a company with optional filters.

        Filters:
          search        — partial match on name, legal_name, trn, email
          customer_type — b2b / b2g / b2c
          country       — ISO 2-letter code
          active_only   — default True (excludes soft-deleted)
        """
        qs = Customer.objects.filter(company=company)

        if active_only:
            qs = qs.filter(is_active=True)

        if search:
            qs = qs.filter(
                django_models.Q(name__icontains=search)
                | django_models.Q(legal_name__icontains=search)
                | django_models.Q(trn__icontains=search)
                | django_models.Q(email__icontains=search)
            )

        if customer_type:
            qs = qs.filter(customer_type=customer_type)

        if country:
            qs = qs.filter(country=country.upper())

        return qs.order_by('name')

    @staticmethod
    def get_customer_for_company(customer_id: str, company: Company) -> Customer:
        """
        Fetch a single customer, ensuring it belongs to the company.
        Returns Customer or raises 404-equivalent.
        """
        try:
            return Customer.objects.get(id=customer_id, company=company, is_active=True)
        except Customer.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound(f'Customer not found.')
