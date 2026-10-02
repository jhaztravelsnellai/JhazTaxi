from rest_framework import serializers
from .models import Vehicle, FareSetting

class VehicleSerializer(serializers.ModelSerializer):
    display_image = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = [
            'id', 'name', 'vehicle_type', 'vehicle_number', 'model',
            'capacity', 'base_fare', 'price_per_km', 'status',
            'image', 'image_url', 'display_image', 'description', 'created_at', 'updated_at'
        ]

    def get_display_image(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        if obj.image_url:
            return obj.image_url
        
        # Category fallback images
        fallbacks = {
            'Mini': 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
            'Sedan': 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=600&q=80',
            'SUV': 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
            'Premium': 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=600&q=80',
        }
        return fallbacks.get(obj.vehicle_type, fallbacks['Sedan'])


class FareSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = FareSetting
        fields = [
            'id', 'vehicle_type', 'base_fare', 'price_per_km', 'min_fare',
            'waiting_charge_per_min', 'night_charge_percent',
            'additional_passenger_charge', 'is_active', 'updated_at'
        ]
