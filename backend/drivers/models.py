from django.db import models
from django.conf import settings
from vehicles.models import Vehicle

class Driver(models.Model):
    STATUS_CHOICES = (
        ('available', 'Available'),
        ('on_trip', 'On Trip'),
        ('offline', 'Offline'),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='driver_profile'
    )
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, help_text="Driver mobile phone number (Required)")
    email = models.EmailField(blank=True, null=True, help_text="Driver email address (Optional)")
    address = models.TextField(blank=True, null=True)

    # Driver Picture (Compulsory)
    profile_image = models.ImageField(upload_to='drivers/', blank=True, null=True)
    profile_photo = models.CharField(max_length=500, blank=True, null=True)

    # Car Picture (Compulsory)
    car_image = models.ImageField(upload_to='driver_cars/', blank=True, null=True)
    car_photo = models.CharField(max_length=500, blank=True, null=True)

    # Vehicle Plate Registration Number (Compulsory)
    vehicle_number = models.CharField(max_length=50, blank=True, null=True, help_text="Vehicle plate number e.g. KA-05-AB-1234")

    license_number = models.CharField(max_length=50, unique=True)
    license_expiry = models.DateField(blank=True, null=True)
    
    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='drivers'
    )
    
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    total_ratings_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    
    # Location coordinates for map tracking
    current_latitude = models.DecimalField(max_digits=9, decimal_places=6, default=13.0827)
    current_longitude = models.DecimalField(max_digits=9, decimal_places=6, default=80.2707)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-rating', 'name']

    def __str__(self):
        return f"{self.name} - {self.status} (Rating: {self.rating})"
