"""
Taxes API views.

Two endpoints:
  GET  /api/v1/taxes/rates/      — UAE VAT rate reference (all rate types + metadata)
  POST /api/v1/taxes/calculate/  — On-demand VAT calculation (amount + rate type)

Both are authenticated but read-only — no company membership required.
"""
from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.common.utils import success_response, error_response
from .serializers import VATCalculateSerializer
from .services import TaxRateService


class VATRateListView(APIView):
    """
    GET /api/v1/taxes/rates/

    Returns all UAE VAT rate types with regulatory descriptions.
    Used to populate rate-type dropdowns in the frontend invoice form.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rates = TaxRateService.get_all_rates()
        # Serialize Decimal → string for JSON transport
        output = []
        for r in rates:
            output.append({
                'code':                 r['code'],
                'label':                r['label'],
                'rate':                 str(r['rate']) if r['rate'] is not None else None,
                'description':          r['description'],
                'input_tax_recovery':   r['input_tax_recovery'],
            })
        return success_response(data=output)


class VATCalculateView(APIView):
    """
    POST /api/v1/taxes/calculate/

    On-demand VAT calculation for a given unit amount, quantity, and rate type.
    Useful for live invoice line-item previews in the frontend.

    Request body:
      {
        "amount": "100.00",         // net unit price
        "vat_rate_type": "standard",
        "quantity": "2.0"           // optional, default 1
      }

    Response:
      {
        "subtotal":     "200.00",
        "vat_rate":     "5.00",
        "vat_amount":   "10.00",
        "total_amount": "210.00",
        "currency":     "AED"
      }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = VATCalculateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Invalid input.', details=serializer.errors, status_code=400)

        data = serializer.validated_data
        result = TaxRateService.calculate(
            amount=data['amount'],
            vat_rate_type=data['vat_rate_type'],
            quantity=data.get('quantity', Decimal('1.0000')),
        )
        return success_response(data=result)
