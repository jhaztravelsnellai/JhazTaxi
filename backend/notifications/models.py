from django.db import models
from django.conf import settings
from bookings.models import Booking

class Notification(models.Model):
    TYPE_CHOICES = (
        ('booking_created', 'Booking Created'),
        ('booking_confirmed', 'Booking Confirmed'),
        ('driver_assigned', 'Driver Assigned'),
        ('driver_arriving', 'Driver Arriving'),
        ('trip_started', 'Trip Started'),
        ('trip_completed', 'Trip Completed'),
        ('booking_cancelled', 'Booking Cancelled'),
        ('system', 'System Notification'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    title = models.CharField(max_length=150)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='system')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] {self.title} for {self.user.username}"
