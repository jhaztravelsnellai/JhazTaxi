import os
import sys
import glob
from decimal import Decimal

# Setup Django environment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.contrib.auth import get_user_model
from bookings.models import Booking, DriverBookingRequest
from payments.models import Payment
from reviews.models import Review
from notifications.models import Notification
from drivers.models import Driver
from vehicles.models import Vehicle, FareSetting

User = get_user_model()

def clean_database():
    print("==================================================================")
    print("   JhazTaxi Production Database Cleanup & Credential Reset")
    print("==================================================================")

    # 1. Delete all test bookings & associated data
    b_count = Booking.objects.count()
    req_count = DriverBookingRequest.objects.count()
    pay_count = Payment.objects.count()
    rev_count = Review.objects.count()
    notif_count = Notification.objects.count()

    DriverBookingRequest.objects.all().delete()
    Payment.objects.all().delete()
    Review.objects.all().delete()
    Notification.objects.all().delete()
    Booking.objects.all().delete()
    print(f" [OK] Purged test bookings ({b_count}), requests ({req_count}), payments ({pay_count}), reviews ({rev_count}), notifications ({notif_count}).")

    # 2. Delete test drivers and test customer users
    drv_count = Driver.objects.count()
    Driver.objects.all().delete()
    print(f" [OK] Purged all test drivers ({drv_count}).")

    # Delete non-admin users
    non_admins = User.objects.filter(role__in=['customer', 'driver'])
    u_count = non_admins.count()
    non_admins.delete()
    print(f" [OK] Purged all test passenger and driver accounts ({u_count}).")

    # 3. Reset and configure Clean Fleet Catalog
    Vehicle.objects.all().delete()
    FareSetting.objects.all().delete()

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
        v = Vehicle.objects.create(
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
        FareSetting.objects.create(
            vehicle_type=item['vehicle_type'],
            base_fare=item['base_fare'],
            price_per_km=item['price_per_km'],
            min_fare=item['base_fare'],
            waiting_charge_per_min=Decimal('2.00'),
            night_charge_percent=Decimal('20.00'),
            additional_passenger_charge=Decimal('30.00'),
            is_active=True
        )
    print(" [OK] Initialized 4 pristine production vehicle categories (Mini, Sedan, SUV, Premium) with fare rules.")

    # 4. Set New Secure Admin Account
    NEW_ADMIN_EMAIL = "admin@jhaztaxi.com"
    NEW_ADMIN_PASS = "JhazTaxi@Admin2026#"

    admin_user = User.objects.filter(is_superuser=True).first() or User.objects.filter(role='admin').first()
    if not admin_user:
        admin_user = User(username='admin')

    admin_user.email = NEW_ADMIN_EMAIL
    admin_user.username = 'admin'
    admin_user.first_name = 'JhazTaxi'
    admin_user.last_name = 'Administrator'
    admin_user.role = 'admin'
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.is_active = True
    admin_user.set_password(NEW_ADMIN_PASS)
    admin_user.save()
    print(f" [OK] Production Admin Account configured: {NEW_ADMIN_EMAIL} with secure password.")

    # 5. Clean test uploaded media files
    media_dir = os.path.join(os.path.dirname(__file__), 'backend', 'media')
    cleaned_files = 0
    for sub in ['drivers', 'driver_cars', 'vehicles']:
        sub_path = os.path.join(media_dir, sub)
        if os.path.exists(sub_path):
            for f in os.listdir(sub_path):
                file_path = os.path.join(sub_path, f)
                if os.path.isfile(file_path):
                    try:
                        os.remove(file_path)
                        cleaned_files += 1
                    except Exception:
                        pass
    print(f" [OK] Cleaned {cleaned_files} dummy uploaded test files from backend/media/.")

    print("\n==================================================================")
    print("   CLEANUP COMPLETE: DATABASE IS PRISTINE FOR PRODUCTION")
    print(f"   Admin Email:    {NEW_ADMIN_EMAIL}")
    print(f"   Admin Password: {NEW_ADMIN_PASS}")
    print("==================================================================")

if __name__ == '__main__':
    clean_database()
