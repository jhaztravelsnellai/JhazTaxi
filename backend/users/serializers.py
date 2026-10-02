from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'phone_number', 'role', 'address', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True, required=False)
    full_name = serializers.CharField(write_only=True, required=False)
    phone_number = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'full_name', 'first_name', 'last_name', 'phone_number', 'password', 'confirm_password', 'role', 'address']
        extra_kwargs = {
            'username': {'required': False},
            'role': {'default': 'customer'}
        }

    def validate(self, attrs):
        full_name = attrs.get('full_name', '').strip()
        first_name = attrs.get('first_name', '').strip()
        if not full_name and not first_name:
            raise serializers.ValidationError({"full_name": "Full name is required."})

        phone = attrs.get('phone_number', '').strip()
        if not phone:
            raise serializers.ValidationError({"phone_number": "Mobile phone number is required."})

        confirm_pwd = attrs.get('confirm_password')
        if confirm_pwd and attrs.get('password') != confirm_pwd:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        full_name = validated_data.pop('full_name', '').strip()
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        if full_name:
            parts = full_name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''

        email = validated_data.get('email')
        raw_username = validated_data.pop('username', None)
        username = raw_username or email.split('@')[0]
        
        # Ensure unique username
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        password = validated_data.pop('password')
        user = User(
            username=username,
            first_name=first_name,
            last_name=last_name,
            **validated_data
        )
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(required=False)
    username = serializers.CharField(required=False)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        email_or_user = attrs.get('email') or attrs.get('username')
        if not email_or_user:
            raise serializers.ValidationError("Email or username or mobile number is required.")
        password = attrs.get('password')

        user_obj = None
        if '@' in email_or_user:
            user_obj = User.objects.filter(email__iexact=email_or_user.strip()).first()
        else:
            clean = email_or_user.strip()
            user_obj = (
                User.objects.filter(username__iexact=clean).first() or
                User.objects.filter(phone_number=clean).first() or
                User.objects.filter(phone_number__endswith=clean[-10:] if len(clean) >= 10 else clean).first() or
                User.objects.filter(email__iexact=clean).first()
            )

        user = None
        if user_obj:
            user = authenticate(username=user_obj.email, password=password)

        if not user:
            raise serializers.ValidationError("Invalid credentials. Please check your username/email/mobile and password.")

        if not user.is_active:
            raise serializers.ValidationError("This account has been disabled. Contact support.")

        attrs['user'] = user
        return attrs


class DriverRegisterSerializer(serializers.Serializer):
    name = serializers.CharField(required=True)
    phone = serializers.CharField(required=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(required=True, write_only=True)
    license_number = serializers.CharField(required=True)
    vehicle_number = serializers.CharField(required=True)
    vehicle_type = serializers.CharField(required=False, default='Sedan')
    address = serializers.CharField(required=False, allow_blank=True)
    profile_image = serializers.ImageField(required=True)
    car_image = serializers.ImageField(required=True)

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({"password": "Passwords do not match."})

        phone = attrs.get('phone', '').strip()
        if not phone:
            raise serializers.ValidationError({"phone": "Driver mobile phone number is required."})

        if User.objects.filter(phone_number=phone).exists():
            raise serializers.ValidationError({"phone": "An account with this mobile number already exists."})

        email = attrs.get('email')
        if email and email.strip():
            if User.objects.filter(email__iexact=email.strip()).exists():
                raise serializers.ValidationError({"email": "An account with this email already exists."})

        from drivers.models import Driver
        lic = attrs.get('license_number', '').strip()
        if Driver.objects.filter(license_number__iexact=lic).exists():
            raise serializers.ValidationError({"license_number": "A driver with this license number already exists."})

        v_num = attrs.get('vehicle_number', '').strip()
        if not v_num:
            raise serializers.ValidationError({"vehicle_number": "Vehicle plate number is compulsory."})

        if not attrs.get('profile_image'):
            raise serializers.ValidationError({"profile_image": "Driver profile picture is compulsory."})

        if not attrs.get('car_image'):
            raise serializers.ValidationError({"car_image": "Car picture is compulsory."})

        return attrs

    def create(self, validated_data):
        from drivers.models import Driver
        from vehicles.models import Vehicle

        name = validated_data['name'].strip()
        phone = validated_data['phone'].strip()
        email = validated_data.get('email', '').strip() if validated_data.get('email') else ''
        if not email:
            clean_digits = ''.join(c for c in phone if c.isdigit())
            email = f"driver_{clean_digits}@jhaztaxi.com"

        password = validated_data['password']
        license_number = validated_data['license_number'].strip()
        vehicle_number = validated_data['vehicle_number'].strip().upper()
        vehicle_type = validated_data.get('vehicle_type', 'Sedan')
        address = validated_data.get('address', '').strip()
        profile_image = validated_data['profile_image']
        car_image = validated_data['car_image']

        # 1. Create or link Vehicle
        vehicle = Vehicle.objects.filter(vehicle_number__iexact=vehicle_number).first()
        if not vehicle:
            rates = {
                'Sedan': (100.0, 15.0),
                'Mini': (80.0, 12.0),
                'SUV': (150.0, 20.0),
                'Premium': (200.0, 25.0)
            }
            base_fare, price_per_km = rates.get(vehicle_type, (100.0, 15.0))
            vehicle = Vehicle.objects.create(
                name=f"{name}'s {vehicle_type}",
                vehicle_type=vehicle_type,
                vehicle_number=vehicle_number,
                model='2024',
                capacity=6 if vehicle_type == 'SUV' else 4,
                base_fare=base_fare,
                price_per_km=price_per_km,
                status='available',
                image=car_image,
                description=f"Driver {name} registered cab"
            )
        elif not vehicle.image and car_image:
            vehicle.image = car_image
            vehicle.save(update_fields=['image'])

        # 2. Create User
        clean_digits = ''.join(c for c in phone if c.isdigit())
        base_username = f"drv_{clean_digits[-6:] if len(clean_digits) >= 6 else clean_digits}"
        username = base_username
        cnt = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{cnt}"
            cnt += 1

        parts = name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''

        user = User.objects.create(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone,
            role='driver',
            address=address
        )
        user.set_password(password)
        user.save()

        # 3. Create Driver Record
        driver = Driver.objects.create(
            user=user,
            name=name,
            phone=phone,
            email=email if validated_data.get('email') else '',
            license_number=license_number,
            vehicle=vehicle,
            vehicle_number=vehicle_number,
            profile_image=profile_image,
            car_image=car_image,
            address=address,
            status='available'
        )

        return user, driver
