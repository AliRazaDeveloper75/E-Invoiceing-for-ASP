from rest_framework import serializers
from .models import Payment, PAYMENT_METHOD_CHOICES


class PaymentCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=15, decimal_places=2, min_value='0.01')
    method = serializers.ChoiceField(choices=[c[0] for c in PAYMENT_METHOD_CHOICES])
    payment_date = serializers.DateField()
    reference = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')


class PaymentSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'amount', 'method', 'method_display',
            'payment_date', 'reference', 'notes',
            'recorded_by_name', 'created_at',
        ]
