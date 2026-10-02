from rest_framework import serializers
from django.db.models import Q
from .models import Driver
from vehicles.models import Vehicle
from vehicles.serializers import VehicleSerializer
from users.models import User

class DriverSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(required=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    vehicle_number = serializers.CharField(required=True)
    profile_image = serializers.ImageField(required=False, allow_null=True)
    car_image = serializers.ImageField(required=False, allow_null=True)
    
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)
    vehicle_name = serializers.SerializerMethodField()
    vehicle_type = serializers.SerializerMethodField()
    vehicle_capacity = serializers.SerializerMethodField()
    display_profile_photo = serializers.SerializerMethodField()
    display_car_photo = serializers.SerializerMethodField()

    class Meta:
        model = Driver
        fields = [
            'id', 'user', 'name', 'phone', 'email', 'address',
            'profile_image', 'profile_photo', 'display_profile_photo',
            'car_image', 'car_photo', 'display_car_photo',
            'license_number', 'license_expiry', 'vehicle', 'vehicle_details',
            'vehicle_name', 'vehicle_type', 'vehicle_number', 'vehicle_capacity',
            'rating', 'total_ratings_count', 'status',
            'current_latitude', 'current_longitude', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'rating', 'total_ratings_count', 'created_at', 'updated_at']

    def validate(self, attrs):
        # 1. Mobile phone number is REQUIRED
        phone = attrs.get('phone') or (self.instance.phone if self.instance else None)
        if not phone or not phone.strip():
            raise serializers.ValidationError({"phone": "Driver mobile phone number is required."})

        # 2. Vehicle Plate Number is COMPULSORY
        v_num = attrs.get('vehicle_number') or (self.instance.vehicle_number if self.instance else None)
        if not v_num or not v_num.strip():
            raise serializers.ValidationError({"vehicle_number": "Vehicle registration number is compulsory."})

        # 3. Driver Picture is COMPULSORY for new driver
        if not self.instance:
            has_p_img = attrs.get('profile_image') is not None
            has_p_url = bool(attrs.get('profile_photo', '').strip() if attrs.get('profile_photo') else False)
            if not has_p_img and not has_p_url:
                raise serializers.ValidationError({"profile_image": "Driver profile picture is compulsory."})

            # 4. Car Picture is COMPULSORY for new driver
            has_c_img = attrs.get('car_image') is not None
            has_c_url = bool(attrs.get('car_photo', '').strip() if attrs.get('car_photo') else False)
            if not has_c_img and not has_c_url:
                raise serializers.ValidationError({"car_image": "Car picture is compulsory."})

        return attrs

    def create(self, validated_data):
        v_num = validated_data.get('vehicle_number', '').strip()
        vehicle = validated_data.get('vehicle')

        # Auto-link or create a Vehicle if not provided
        if not vehicle and v_num:
            vehicle = Vehicle.objects.filter(vehicle_number__iexact=v_num).first()
            if not vehicle:
                # Create vehicle record for this driver's car
                car_img = validated_data.get('car_image')
                car_url = validated_data.get('car_photo')
                vehicle = Vehicle.objects.create(
                    name=f"{validated_data.get('name', 'Driver')}'s Car",
                    vehicle_type='Sedan',
                    vehicle_number=v_num,
                    model='2024',
                    capacity=4,
                    base_fare=100.00,
                    price_per_km=15.00,
                    status='available',
                    image=car_img,
                    image_url=car_url,
                    description=f"Driver {validated_data.get('name')} registered vehicle"
                )
            validated_data['vehicle'] = vehicle

        driver = super().create(validated_data)

        # Auto-create or link User account for Driver Portal Login
        phone = driver.phone.strip()
        email = driver.email.strip() if driver.email else f"driver_{phone.replace('+', '').replace(' ', '')}@jhaztaxi.com"
        
        user = User.objects.filter(Q(email__iexact=email) | Q(phone_number=phone)).first()
        if not user:
            clean_digits = ''.join(c for c in phone if c.isdigit())
            base_username = f"drv_{clean_digits[-6:] if len(clean_digits)>=6 else driver.id}"
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            user = User.objects.create(
                email=email,
                username=username,
                first_name=driver.name,
                phone_number=phone,
                role='driver'
            )
            user.set_password('driver123')
            user.save()

        driver.user = user
        if not driver.email and email:
            driver.email = email
        driver.save(update_fields=['user', 'email'])

        return driver

    def get_vehicle_name(self, obj):
        if obj.vehicle:
            return obj.vehicle.name
        return f"Car ({obj.vehicle_number})" if obj.vehicle_number else "Vehicle"

    def get_vehicle_type(self, obj):
        if obj.vehicle:
            return obj.vehicle.vehicle_type
        return "Sedan"

    def get_vehicle_capacity(self, obj):
        if obj.vehicle:
            return obj.vehicle.capacity
        return 4

    def get_display_profile_photo(self, obj):
        request = self.context.get('request')
        if obj.profile_image:
            if request:
                return request.build_absolute_uri(obj.profile_image.url)
            return obj.profile_image.url
        if obj.profile_photo:
            return obj.profile_photo
        return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80"

    def get_display_car_photo(self, obj):
        request = self.context.get('request')
        if obj.car_image:
            if request:
                return request.build_absolute_uri(obj.car_image.url)
            return obj.car_image.url
        if obj.car_photo:
            return obj.car_photo
        if obj.vehicle and hasattr(obj.vehicle, 'image') and obj.vehicle.image:
            if request:
                return request.build_absolute_uri(obj.vehicle.image.url)
            return obj.vehicle.image.url
        if obj.vehicle and obj.vehicle.image_url:
            return obj.vehicle.image_url
        return "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=600&q=80"
