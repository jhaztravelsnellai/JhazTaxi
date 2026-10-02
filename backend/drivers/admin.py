from django.contrib import admin
from .models import Driver

@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'license_number', 'vehicle', 'rating', 'status']
    list_filter = ['status']
    search_fields = ['name', 'phone', 'license_number']
