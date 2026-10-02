from django.contrib import admin
from .models import Booking

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['booking_id', 'customer', 'driver', 'vehicle', 'pickup_date', 'distance_km', 'total_fare', 'status', 'payment_status']
    list_filter = ['status', 'payment_status', 'payment_method', 'pickup_date']
    search_fields = ['booking_id', 'customer__email', 'customer__first_name', 'driver__name', 'pickup_address', 'drop_address']
