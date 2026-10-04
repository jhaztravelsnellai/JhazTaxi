from django.db import migrations

def update_real_images(apps, schema_editor):
    Vehicle = apps.get_model('vehicles', 'Vehicle')
    
    # Update Sedan
    Vehicle.objects.filter(vehicle_type='Sedan').update(
        image_url='/assets/vehicles/sedan_dzire.jpg',
        name='Maruti Dzire / Toyota Etios (AC Sedan)',
        description='Crisp, comfortable air-conditioned sedan tailored for one-way drops, airport runs, and highway travel.'
    )
    
    # Update SUV
    Vehicle.objects.filter(vehicle_type='SUV').update(
        image_url='/assets/vehicles/suv_ertiga.jpg',
        name='Maruti Ertiga / Mahindra Scorpio (AC SUV)',
        description='Spacious 6-seater multi-utility vehicle with dual AC, expansive boot space, and smooth highway ride.'
    )
    
    # Update Innova Crysta
    Vehicle.objects.filter(vehicle_type='Innova Crysta').update(
        image_url='/assets/vehicles/innova_crysta.jpg',
        name='Toyota Innova Crysta (Luxury 7+1 AC)',
        description='Supreme luxury 7-passenger MPV with reclining captain seats, exceptional comfort, and rear AC vents.'
    )

def reverse_images(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('vehicles', '0003_faresetting_driver_bata_faresetting_min_km_and_more'),
    ]

    operations = [
        migrations.RunPython(update_real_images, reverse_images),
    ]
