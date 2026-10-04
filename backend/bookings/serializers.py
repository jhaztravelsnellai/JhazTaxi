from rest_framework import serializers
from .models import Booking
from vehicles.serializers import VehicleSerializer
from drivers.serializers import DriverSerializer
from users.serializers import UserSerializer

class BookingSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    customer_phone = serializers.SerializerMethodField()
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)
    driver_details = DriverSerializer(source='driver', read_only=True)
    driver_requests_count = serializers.SerializerMethodField()
    my_request_status = serializers.SerializerMethodField()
    has_review = serializers.SerializerMethodField()

    def get_customer_name(self, obj):
        if obj.customer:
            name = (obj.customer.get_full_name() or obj.customer.first_name or '').strip()
            if name:
                return name
            return obj.customer.username
        return "Customer"

    def get_customer_phone(self, obj):
        if obj.customer and obj.customer.phone_number:
            return obj.customer.phone_number
        return ""

    class Meta:
        model = Booking
        fields = [
            'id', 'booking_id', 'customer', 'customer_name', 'customer_email', 'customer_phone',
            'driver', 'driver_details', 'vehicle', 'vehicle_details',
            'pickup_address', 'pickup_lat', 'pickup_lng',
            'drop_address', 'drop_lat', 'drop_lng',
            'pickup_date', 'pickup_time', 'passengers',
            'distance_km', 'duration_mins',
            'base_fare', 'price_per_km', 'billable_km', 'distance_fare', 'driver_bata',
            'waiting_charge', 'night_charge', 'additional_passenger_charge',
            'total_fare', 'payment_method', 'payment_status', 'status',
            'cancellation_reason', 'customer_notes', 'has_review',
            'driver_requests_count', 'my_request_status',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'booking_id', 'customer', 'base_fare', 'price_per_km',
            'distance_fare', 'total_fare', 'created_at', 'updated_at'
        ]

    def get_has_review(self, obj):
        return hasattr(obj, 'review')

    def get_driver_requests_count(self, obj):
        return obj.driver_requests.count()

    def get_my_request_status(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'driver':
            driver = getattr(request.user, 'driver_profile', None)
            if driver:
                req = obj.driver_requests.filter(driver=driver).first()
                if req:
                    return req.status
        return None


class DriverBookingRequestSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    driver_phone = serializers.CharField(source='driver.phone', read_only=True)
    driver_rating = serializers.DecimalField(source='driver.rating', max_digits=3, decimal_places=2, read_only=True)
    driver_vehicle_name = serializers.SerializerMethodField()
    driver_vehicle_type = serializers.SerializerMethodField()
    driver_vehicle_number = serializers.SerializerMethodField()
    driver_profile_photo = serializers.SerializerMethodField()
    driver_car_photo = serializers.SerializerMethodField()
    booking_details = BookingSerializer(source='booking', read_only=True)

    class Meta:
        from .models import DriverBookingRequest
        model = DriverBookingRequest
        fields = [
            'id', 'booking', 'booking_details', 'driver', 'driver_name',
            'driver_phone', 'driver_rating', 'driver_profile_photo',
            'driver_vehicle_name', 'driver_vehicle_type', 'driver_vehicle_number',
            'driver_car_photo',
            'status', 'driver_note', 'admin_notes', 'created_at', 'reviewed_at'
        ]
        read_only_fields = ['id', 'status', 'created_at', 'reviewed_at']

    def get_driver_vehicle_name(self, obj):
        if obj.driver and obj.driver.vehicle:
            return obj.driver.vehicle.name
        return "Taxi"

    def get_driver_vehicle_type(self, obj):
        if obj.driver and obj.driver.vehicle:
            return obj.driver.vehicle.vehicle_type
        return "Sedan"

    def get_driver_vehicle_number(self, obj):
        if obj.driver:
            return obj.driver.vehicle_number or (obj.driver.vehicle.vehicle_number if obj.driver.vehicle else '')
        return ''

    def get_driver_profile_photo(self, obj):
        request = self.context.get('request')
        if obj.driver:
            if obj.driver.profile_image:
                return request.build_absolute_uri(obj.driver.profile_image.url) if request else obj.driver.profile_image.url
            if obj.driver.profile_photo:
                return obj.driver.profile_photo
        return "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"

    def get_driver_car_photo(self, obj):
        request = self.context.get('request')
        if obj.driver:
            if obj.driver.car_image:
                return request.build_absolute_uri(obj.driver.car_image.url) if request else obj.driver.car_image.url
            if obj.driver.car_photo:
                return obj.driver.car_photo
            if obj.driver.vehicle and obj.driver.vehicle.image:
                return request.build_absolute_uri(obj.driver.vehicle.image.url) if request else obj.driver.vehicle.image.url
            if obj.driver.vehicle and obj.driver.vehicle.image_url:
                return obj.driver.vehicle.image_url
        return "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=120&q=80"

