import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from users.models import User
from vehicles.models import Vehicle, FareSetting
from drivers.models import Driver
from bookings.models import Booking
from payments.models import Payment
from reviews.models import Review
from notifications.models import Notification

class Command(BaseCommand):
    help = 'Seeds initial sample data for JhazTaxi development and demonstration'

    def handle(self, *args, **options):
        self.stdout.write("Seeding JhazTaxi database...")

        # 1. Create Admin User
        admin_user, created = User.objects.get_or_create(
            email='admin@jhaztaxi.com',
            defaults={
                'username': 'admin',
                'first_name': 'JhazTaxi',
                'last_name': 'Admin',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
                'phone_number': '+91 98765 00001'
            }
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("Created admin user: admin@jhaztaxi.com / admin123"))
        else:
            admin_user.role = 'admin'
            admin_user.is_staff = True
            admin_user.save()

        # 2. Create Demo Customer
        customer_user, created = User.objects.get_or_create(
            email='customer@jhaztaxi.com',
            defaults={
                'username': 'democustomer',
                'first_name': 'Rahul',
                'last_name': 'Sharma',
                'role': 'customer',
                'phone_number': '+91 98765 11111',
                'address': 'MG Road, Indiranagar, Bengaluru'
            }
        )
        if created:
            customer_user.set_password('customer123')
            customer_user.save()
            self.stdout.write(self.style.SUCCESS("Created demo customer: customer@jhaztaxi.com / customer123"))

        # 3. Create Vehicles & Fare Settings
        vehicle_configs = [
            {
                'name': 'Hyundai Grand i10',
                'vehicle_type': 'Mini',
                'vehicle_number': 'KA-01-MJ-1001',
                'model': '2023',
                'capacity': 4,
                'base_fare': Decimal('80.00'),
                'price_per_km': Decimal('12.00'),
                'image_url': 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
                'description': 'Pocket-friendly rides for daily quick city commutes.'
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
                'description': 'Spacious and comfortable sedans with generous boot space.'
            },
            {
                'name': 'Toyota Innova Crysta',
                'vehicle_type': 'SUV',
                'vehicle_number': 'KA-01-MJ-3003',
                'model': '2023',
                'capacity': 6,
                'base_fare': Decimal('120.00'),
                'price_per_km': Decimal('20.00'),
                'image_url': 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
                'description': 'Large family SUV with 6 passenger seats and extra luggage capacity.'
            },
            {
                'name': 'Mercedes-Benz E-Class',
                'vehicle_type': 'Premium',
                'vehicle_number': 'KA-01-MJ-4004',
                'model': '2024',
                'capacity': 4,
                'base_fare': Decimal('150.00'),
                'price_per_km': Decimal('25.00'),
                'image_url': 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=600&q=80',
                'description': 'Luxury executive travel with plush leather seats and chauffeur service.'
            },
        ]

        vehicles_dict = {}
        for vc in vehicle_configs:
            v_type = vc['vehicle_type']
            v, _ = Vehicle.objects.get_or_create(
                vehicle_number=vc['vehicle_number'],
                defaults=vc
            )
            vehicles_dict[v_type] = v

            # Fare Settings
            FareSetting.objects.get_or_create(
                vehicle_type=v_type,
                defaults={
                    'base_fare': vc['base_fare'],
                    'price_per_km': vc['price_per_km'],
                    'min_fare': vc['base_fare'],
                    'waiting_charge_per_min': Decimal('2.00'),
                    'night_charge_percent': Decimal('15.00'),
                    'additional_passenger_charge': Decimal('20.00'),
                    'is_active': True
                }
            )

        # 4. Create Sample Drivers
        drivers_data = [
            {
                'name': 'Kumar',
                'phone': '+91 98450 12341',
                'email': 'kumar.driver@jhaztaxi.com',
                'address': 'Koramangala, Bengaluru',
                'license_number': 'DL-KA-2018-00124',
                'license_expiry': '2030-05-15',
                'vehicle': vehicles_dict.get('Sedan'),
                'rating': Decimal('4.9'),
                'total_ratings_count': 128,
                'status': 'available',
                'current_latitude': Decimal('12.9352'),
                'current_longitude': Decimal('77.6245'),
                'profile_photo': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80'
            },
            {
                'name': 'Suresh',
                'phone': '+91 98450 12342',
                'email': 'suresh.driver@jhaztaxi.com',
                'address': 'HSR Layout, Bengaluru',
                'license_number': 'DL-KA-2019-00452',
                'license_expiry': '2029-08-20',
                'vehicle': vehicles_dict.get('Mini'),
                'rating': Decimal('4.8'),
                'total_ratings_count': 94,
                'status': 'available',
                'current_latitude': Decimal('12.9121'),
                'current_longitude': Decimal('77.6446'),
                'profile_photo': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'
            },
            {
                'name': 'Arun',
                'phone': '+91 98450 12343',
                'email': 'arun.driver@jhaztaxi.com',
                'address': 'Whitefield, Bengaluru',
                'license_number': 'DL-KA-2017-00981',
                'license_expiry': '2028-11-10',
                'vehicle': vehicles_dict.get('SUV'),
                'rating': Decimal('4.95'),
                'total_ratings_count': 210,
                'status': 'available',
                'current_latitude': Decimal('12.9698'),
                'current_longitude': Decimal('77.7499'),
                'profile_photo': 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=250&q=80'
            },
            {
                'name': 'Mohammed',
                'phone': '+91 98450 12344',
                'email': 'mohammed.driver@jhaztaxi.com',
                'address': 'MG Road, Bengaluru',
                'license_number': 'DL-KA-2020-00331',
                'license_expiry': '2032-02-14',
                'vehicle': vehicles_dict.get('Premium'),
                'rating': Decimal('5.0'),
                'total_ratings_count': 76,
                'status': 'available',
                'current_latitude': Decimal('12.9756'),
                'current_longitude': Decimal('77.6094'),
                'profile_photo': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
            }
        ]

        drivers_dict = {}
        for dd in drivers_data:
            d_name = dd['name']
            driver, _ = Driver.objects.get_or_create(
                license_number=dd['license_number'],
                defaults=dd
            )
            drivers_dict[d_name] = driver

        # 5. Create Sample Bookings
        today = timezone.localdate() if hasattr(timezone, 'localdate') else datetime.date.today()
        
        sample_bookings_data = [
            {
                'customer': customer_user,
                'vehicle': vehicles_dict['Sedan'],
                'driver': drivers_dict['Kumar'],
                'pickup_address': 'MG Road Metro Station, Bengaluru',
                'pickup_lat': Decimal('12.9756'),
                'pickup_lng': Decimal('77.6094'),
                'drop_address': 'Kempegowda International Airport (BLR)',
                'drop_lat': Decimal('13.1986'),
                'drop_lng': Decimal('77.7066'),
                'pickup_date': today - datetime.timedelta(days=1),
                'pickup_time': '10:30',
                'passengers': 2,
                'distance_km': Decimal('34.50'),
                'duration_mins': 55,
                'base_fare': Decimal('100.00'),
                'price_per_km': Decimal('15.00'),
                'distance_fare': Decimal('517.50'),
                'total_fare': Decimal('617.50'),
                'payment_method': 'cash',
                'payment_status': 'paid',
                'status': 'trip_completed',
            },
            {
                'customer': customer_user,
                'vehicle': vehicles_dict['Mini'],
                'driver': drivers_dict['Suresh'],
                'pickup_address': 'Indiranagar 100ft Road',
                'pickup_lat': Decimal('12.9784'),
                'pickup_lng': Decimal('77.6408'),
                'drop_address': 'Koramangala 5th Block',
                'drop_lat': Decimal('12.9352'),
                'drop_lng': Decimal('77.6245'),
                'pickup_date': today,
                'pickup_time': '14:00',
                'passengers': 1,
                'distance_km': Decimal('6.80'),
                'duration_mins': 22,
                'base_fare': Decimal('80.00'),
                'price_per_km': Decimal('12.00'),
                'distance_fare': Decimal('81.60'),
                'total_fare': Decimal('161.60'),
                'payment_method': 'upi',
                'payment_status': 'pending',
                'status': 'driver_assigned',
            },
            {
                'customer': customer_user,
                'vehicle': vehicles_dict['SUV'],
                'driver': None,
                'pickup_address': 'Electronic City Phase 1',
                'pickup_lat': Decimal('12.8452'),
                'pickup_lng': Decimal('77.6602'),
                'drop_address': 'Commercial Street, Tasker Town',
                'drop_lat': Decimal('12.9822'),
                'drop_lng': Decimal('77.6083'),
                'pickup_date': today + datetime.timedelta(days=1),
                'pickup_time': '09:00',
                'passengers': 5,
                'distance_km': Decimal('19.20'),
                'duration_mins': 45,
                'base_fare': Decimal('120.00'),
                'price_per_km': Decimal('20.00'),
                'distance_fare': Decimal('384.00'),
                'total_fare': Decimal('504.00'),
                'payment_method': 'cash',
                'payment_status': 'pending',
                'status': 'pending',
            },
        ]

        for b_data in sample_bookings_data:
            if not Booking.objects.filter(customer=b_data['customer'], pickup_date=b_data['pickup_date'], pickup_time=b_data['pickup_time']).exists():
                b = Booking.objects.create(**b_data)
                
                # Payment
                Payment.objects.create(
                    booking=b,
                    amount=b.total_fare,
                    payment_method=b.payment_method,
                    payment_status='completed' if b.status == 'trip_completed' else 'pending'
                )

                # Review if completed
                if b.status == 'trip_completed' and b.driver:
                    Review.objects.create(
                        booking=b,
                        customer=b.customer,
                        driver=b.driver,
                        rating=5,
                        comment="Excellent driver! Very polite, on-time, and smooth ride."
                    )

                # Notification
                Notification.objects.create(
                    user=b.customer,
                    booking=b,
                    title=f"Ride {b.status.replace('_', ' ').title()}",
                    message=f"Booking {b.booking_id} status is now {b.status}.",
                    notification_type='system'
                )

        self.stdout.write(self.style.SUCCESS("Successfully seeded all JhazTaxi sample data!"))
