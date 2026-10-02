from rest_framework import serializers
from .models import Review

class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    booking_id_str = serializers.CharField(source='booking.booking_id', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'booking', 'booking_id_str', 'customer', 'customer_name',
            'driver', 'driver_name', 'rating', 'comment', 'created_at'
        ]
        read_only_fields = ['id', 'customer', 'created_at']
