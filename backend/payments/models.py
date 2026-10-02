import urllib.parse
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


class PaymentSetting(models.Model):
    """
    Centralized Payment Setting where Admin uploads their official GPay / UPI Scanner
    and configures business UPI details for all customer & driver rides.
    """
    title = models.CharField(max_length=150, default="Official GPay / UPI Scanner")
    upi_id = models.CharField(max_length=100, default="jhaztaxi@upi", blank=True)
    payee_name = models.CharField(max_length=150, default="JhazTaxi Travels", blank=True)
    phone_number = models.CharField(max_length=20, default="+91 98765 43210", blank=True)
    qr_image = models.ImageField(upload_to='payment_qr/', blank=True, null=True)
    instructions = models.TextField(
        blank=True,
        default="Scan this official QR code using Google Pay, PhonePe, Paytm, or any BHIM UPI app. Show payment confirmation screen to your driver upon arrival or trip completion."
    )
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Payment Setting"
        verbose_name_plural = "Payment Settings"

    def __str__(self):
        return f"{self.title} ({self.upi_id})"

    def get_qr_url(self, request=None):
        if self.qr_image:
            try:
                if request:
                    return request.build_absolute_uri(self.qr_image.url)
                return self.qr_image.url
            except Exception:
                pass
        # Auto-generated dynamic QR code if no custom image uploaded
        encoded_payee = urllib.parse.quote(self.payee_name or 'JhazTaxi')
        upi_string = f"upi://pay?pa={self.upi_id or 'jhaztaxi@upi'}&pn={encoded_payee}&cu=INR"
        return f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={urllib.parse.quote(upi_string)}"
