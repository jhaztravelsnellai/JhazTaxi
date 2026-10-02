from django.db import models
from django.conf import settings
from vehicles.models import Vehicle
from drivers.models import Driver

class Booking(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('driver_assigned', 'Driver Assigned'),
        ('driver_arriving', 'Driver Arriving'),
        ('trip_started', 'Trip Started'),
        ('trip_completed', 'Trip Completed'),
        ('cancelled', 'Cancelled'),
    )

    PAYMENT_METHOD_CHOICES = (
        ('cash', 'Cash on Delivery (COD)'),
        ('upi', 'UPI Payment'),
        ('gpay', 'Google Pay (GPay)'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    )

    booking_id = models.CharField(max_length=20, unique=True, editable=False, db_index=True)
    
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookings'
    )
    driver = models.ForeignKey(
        Driver,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings'
    )
    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.PROTECT,
        related_name='bookings'
    )

    # Locations
    pickup_address = models.CharField(max_length=255)
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    drop_address = models.CharField(max_length=255)
    drop_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    drop_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # Schedule & Details
    pickup_date = models.DateField()
    pickup_time = models.TimeField()
    passengers = models.PositiveIntegerField(default=1)

    # Trip Metrics
    distance_km = models.DecimalField(max_digits=8, decimal_places=2, help_text="Road distance in kilometers")
    duration_mins = models.PositiveIntegerField(help_text="Estimated road duration in minutes", default=15)

    # Fare Breakdown
    base_fare = models.DecimalField(max_digits=8, decimal_places=2, default=100.00)
    price_per_km = models.DecimalField(max_digits=8, decimal_places=2, default=15.00)
    distance_fare = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    waiting_charge = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    night_charge = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    additional_passenger_charge = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    total_fare = models.DecimalField(max_digits=8, decimal_places=2)

    # Payment & Status
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='cash')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    
    cancellation_reason = models.TextField(blank=True, null=True)
    customer_notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.booking_id:
            last = Booking.objects.order_by('-id').first()
            next_num = (last.id + 1) if last and last.id else 1
            self.booking_id = f"JHZ-{next_num:06d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.booking_id} - {self.customer.get_full_name() or self.customer.username} ({self.status})"


class DriverBookingRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Admin Approval'),
        ('approved', 'Approved / Assigned'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    )

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='driver_requests'
    )
    driver = models.ForeignKey(
        Driver,
        on_delete=models.CASCADE,
        related_name='booking_requests'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    driver_note = models.TextField(blank=True, null=True, help_text="Optional note from driver")
    admin_notes = models.TextField(blank=True, null=True, help_text="Notes from admin upon review")
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('booking', 'driver')

    def __str__(self):
        return f"Request by {self.driver.name} for {self.booking.booking_id} ({self.status})"

