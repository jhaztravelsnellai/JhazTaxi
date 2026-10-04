from django.db import models

class Vehicle(models.Model):
    TYPE_CHOICES = (
        ('Sedan', 'Sedan'),
        ('SUV', 'SUV'),
        ('Innova Crysta', 'Innova Crysta'),
    )

    STATUS_CHOICES = (
        ('available', 'Available'),
        ('maintenance', 'Maintenance'),
        ('inactive', 'Inactive'),
    )

    name = models.CharField(max_length=100, help_text="e.g. Maruti Dzire, Toyota Innova Crysta")
    vehicle_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='Sedan')
    vehicle_number = models.CharField(max_length=30, unique=True, help_text="Registration Plate Number")
    model = models.CharField(max_length=50, blank=True, null=True, help_text="Year/Model e.g. 2024")
    capacity = models.PositiveIntegerField(default=4)
    base_fare = models.DecimalField(max_digits=8, decimal_places=2, default=100.00)
    price_per_km = models.DecimalField(max_digits=8, decimal_places=2, default=14.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    image = models.ImageField(upload_to='vehicles/', blank=True, null=True, help_text="Upload vehicle photograph")
    image_url = models.CharField(max_length=500, blank=True, null=True, help_text="Or external image URL")
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['vehicle_type', 'name']

    def __str__(self):
        return f"{self.name} [{self.vehicle_type}] - {self.vehicle_number}"


class FareSetting(models.Model):
    VEHICLE_TYPES = (
        ('Sedan', 'Sedan'),
        ('SUV', 'SUV'),
        ('Innova Crysta', 'Innova Crysta'),
    )

    vehicle_type = models.CharField(max_length=30, choices=VEHICLE_TYPES, unique=True)
    base_fare = models.DecimalField(max_digits=8, decimal_places=2, default=100.00)
    price_per_km = models.DecimalField(max_digits=8, decimal_places=2, default=14.00)
    min_km = models.DecimalField(max_digits=6, decimal_places=2, default=130.00, help_text="Minimum base distance (e.g. 130 KM)")
    driver_bata = models.DecimalField(max_digits=6, decimal_places=2, default=400.00, help_text="Driver Bata charge (e.g. Rs.400)")
    min_fare = models.DecimalField(max_digits=8, decimal_places=2, default=80.00)
    waiting_charge_per_min = models.DecimalField(max_digits=6, decimal_places=2, default=2.00)
    night_charge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=15.00, help_text="Percentage added for night rides (10 PM - 6 AM)")
    additional_passenger_charge = models.DecimalField(max_digits=6, decimal_places=2, default=20.00, help_text="Charge for extra passengers exceeding standard capacity")
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.vehicle_type} Fare Config: Rs.{self.price_per_km}/km, Min {self.min_km}KM, Bata Rs.{self.driver_bata}"

