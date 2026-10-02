from django.contrib import admin
from .models import Payment

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'booking', 'amount', 'payment_method', 'payment_status', 'transaction_id', 'created_at']
    list_filter = ['payment_method', 'payment_status']
