from django.contrib import admin
from .models import Vehicle, FareSetting

@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ['name', 'vehicle_type', 'vehicle_number', 'capacity', 'base_fare', 'price_per_km', 'status']
    list_filter = ['vehicle_type', 'status']
    search_fields = ['name', 'vehicle_number', 'model']

@admin.register(FareSetting)
class FareSettingAdmin(admin.ModelAdmin):
    list_display = ['vehicle_type', 'base_fare', 'price_per_km', 'min_fare', 'waiting_charge_per_min', 'night_charge_percent', 'is_active']
    list_filter = ['is_active']
