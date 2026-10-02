from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    booking_id_str = serializers.CharField(source='booking.booking_id', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'booking', 'booking_id_str', 'title',
            'message', 'notification_type', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']
