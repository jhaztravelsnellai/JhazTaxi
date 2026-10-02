import os
import sys

sys.path.insert(0, os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from users.models import User
from drivers.models import Driver

# Ensure demo driver user exists
demo_driver_user, created = User.objects.get_or_create(
    email='driver@jhaztaxi.com',
    defaults={
        'username': 'driver',
        'first_name': 'Kumar',
        'last_name': 'Driver',
        'role': 'driver',
        'phone_number': '+91 98450 11111'
    }
)
demo_driver_user.set_password('driver123')
demo_driver_user.role = 'driver'
demo_driver_user.save()

# Check if a Driver profile exists for this demo user
kumar_driver = Driver.objects.filter(name__icontains='Kumar').first()
if not kumar_driver:
    from vehicles.models import Vehicle
    v = Vehicle.objects.filter(vehicle_type='Sedan').first()
    kumar_driver = Driver.objects.create(
        user=demo_driver_user,
        name='Kumar',
        phone='+91 98450 11111',
        email='driver@jhaztaxi.com',
        license_number='DL-KA-2018-00123',
        license_expiry='2030-05-15',
        vehicle=v,
        rating=4.92,
        status='available'
    )
    print("Created Driver profile for Kumar")
else:
    kumar_driver.user = demo_driver_user
    kumar_driver.save()
    print("Linked Kumar to driver@jhaztaxi.com")

# Link other drivers
for d in Driver.objects.all():
    if not d.user:
        u_email = d.email or f"{d.name.lower()}@jhaztaxi.com"
        u, _ = User.objects.get_or_create(
            email=u_email,
            defaults={
                'username': d.name.lower().replace(' ', '_'),
                'first_name': d.name,
                'role': 'driver',
                'phone_number': d.phone
            }
        )
        u.set_password('driver123')
        u.role = 'driver'
        u.save()
        d.user = u
        d.save()
        print(f"Linked {d.name} to {u_email}")

print("All drivers linked successfully!")
