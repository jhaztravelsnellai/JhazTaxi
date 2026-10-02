import os
import sys
from decimal import Decimal

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.contrib.auth import get_user_model
from vehicles.models import Vehicle, FareSetting

User = get_user_model()

def init_production():
    print("==================================================================")
    print("   JhazTaxi Production Initialization")
    print("==================================================================")

    # 1. Admin Setup
    admin_email = os.getenv('ADMIN_EMAIL', 'admin@jhaztaxi.com')
    admin_password = os.getenv('ADMIN_PASSWORD', 'JhazTaxi@Admin2026#')
    admin_username = 'admin'

    admin_user = User.objects.filter(is_superuser=True).first() or User.objects.filter(role='admin').first()
    if not admin_user:
        admin_user = User(username=admin_username)

    admin_user.email = admin_email
    admin_user.username = admin_username
    admin_user.first_name = 'JhazTaxi'
    admin_user.last_name = 'Administrator'
    admin_user.role = 'admin'
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.is_active = True
    admin_user.set_password(admin_password)
    admin_user.save()
    print(f" [OK] Production Admin Account configured: {admin_email}")

    # 2. Vehicle Catalog & Fare Settings Setup (if empty)
    if Vehicle.objects.count() == 0:
        fleet = [
            {
                'name': 'Hyundai Grand i10',
                'vehicle_type': 'Mini',
                'vehicle_number': 'KA-01-MJ-1001',
                'model': '2024',
                'capacity': 4,
                'base_fare': Decimal('80.00'),
                'price_per_km': Decimal('12.00'),
                'image_url': 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
                'description': 'Pocket-friendly rides for daily quick city commutes with full AC.'
            },
            {
                'name': 'Honda City Deluxe',
                'vehicle_type': 'Sedan',
                'vehicle_number': 'KA-01-MJ-2002',
                'model': '2024',
                'capacity': 4,
                'base_fare': Decimal('100.00'),
                'price_per_km': Decimal('15.00'),
                'image_url': 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=600&q=80',
                'description': 'Spacious and comfortable sedans with generous boot space for airport & outstation.'
            },
            {
                'name': 'Toyota Innova Crysta',
                'vehicle_type': 'SUV',
                'vehicle_number': 'KA-01-MJ-3003',
                'model': '2024',
                'capacity': 6,
                'base_fare': Decimal('150.00'),
                'price_per_km': Decimal('20.00'),
                'image_url': 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
                'description': 'Large 6-seater premium SUV ideal for family trips, outstation, and heavy luggage.'
            },
            {
                'name': 'Mercedes-Benz E-Class',
                'vehicle_type': 'Premium',
                'vehicle_number': 'KA-01-MJ-4004',
                'model': '2024',
                'capacity': 4,
                'base_fare': Decimal('250.00'),
                'price_per_km': Decimal('35.00'),
                'image_url': 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=600&q=80',
                'description': 'Luxury chauffeur-driven experience with top-tier comfort and executive amenities.'
            }
        ]

        for item in fleet:
            Vehicle.objects.create(
                name=item['name'],
                vehicle_type=item['vehicle_type'],
                vehicle_number=item['vehicle_number'],
                model=item['model'],
                capacity=item['capacity'],
                base_fare=item['base_fare'],
                price_per_km=item['price_per_km'],
                image_url=item['image_url'],
                description=item['description'],
                status='available'
            )
            FareSetting.objects.update_or_create(
                vehicle_type=item['vehicle_type'],
                defaults={
                    'base_fare': item['base_fare'],
                    'price_per_km': item['price_per_km'],
                    'min_fare': item['base_fare'],
                    'waiting_charge_per_min': Decimal('2.00'),
                    'night_charge_percent': Decimal('20.00'),
                    'additional_passenger_charge': Decimal('30.00'),
                    'is_active': True
                }
            )
        print(" [OK] Initialized 4 pristine production vehicle categories (Mini, Sedan, SUV, Premium) with fare rules.")
    else:
        print(f" [INFO] Vehicle catalog already initialized ({Vehicle.objects.count()} vehicles). Skipping.")

    # 3. Ensure Default PaymentSetting exists for Admin GPay Scanner
    from payments.models import PaymentSetting
    p_set, created = PaymentSetting.objects.get_or_create(
        defaults={
            'title': 'Official GPay / UPI Scanner',
            'upi_id': 'jhaztaxi@upi',
            'payee_name': 'JhazTaxi Travels',
            'phone_number': '+91 98765 43210',
            'instructions': 'Scan this official QR code using Google Pay, PhonePe, Paytm, or any BHIM UPI app. Show payment confirmation screen to your driver upon arrival or trip completion.',
            'is_active': True
        }
    )
    if created:
        print(" [OK] Initialized default PaymentSetting for GPay & UPI.")

    print("==================================================================")
    print("   PRODUCTION INITIALIZATION COMPLETE")
    print("==================================================================")

if __name__ == '__main__':
    init_production()
