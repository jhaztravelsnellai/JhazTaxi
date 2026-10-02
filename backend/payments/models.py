from django.db import models
from bookings.models import Booking

class Payment(models.Model):
    METHOD_CHOICES = (
        ('cash', 'Cash on Delivery (COD)'),
        ('upi', 'UPI Payment'),
        ('gpay', 'Google Pay (GPay)'),
        ('card', 'Credit/Debit Card (Future)'),
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')
    payment_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    gateway_metadata = models.JSONField(blank=True, null=True, help_text="Architecture hook for Razorpay/Stripe payloads")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment {self.transaction_id or self.id} for {self.booking.booking_id}: Rs.{self.amount} ({self.payment_status})"
