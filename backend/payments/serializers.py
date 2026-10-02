from rest_framework import serializers
from .models import Payment, PaymentSetting

class PaymentSerializer(serializers.ModelSerializer):
    booking_id = serializers.CharField(source='booking.booking_id', read_only=True)
    customer_name = serializers.CharField(source='booking.customer.get_full_name', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'booking', 'booking_id', 'customer_name', 'amount',
            'payment_method', 'payment_status', 'transaction_id',
            'gateway_metadata', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PaymentSettingSerializer(serializers.ModelSerializer):
    qr_image_url = serializers.SerializerMethodField()

    class Meta:
        model = PaymentSetting
        fields = [
            'id', 'title', 'upi_id', 'payee_name', 'phone_number',
            'qr_image', 'qr_image_url', 'instructions', 'is_active', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at', 'qr_image_url']

    def get_qr_image_url(self, obj):
        request = self.context.get('request')
        return obj.get_qr_url(request)
