from django.urls import path
from . import views

urlpatterns = [
    path('vehicles/', views.vehicle_list_create_view, name='vehicle_list_create'),
    path('vehicles/<int:pk>/', views.vehicle_detail_view, name='vehicle_detail'),
    path('fare/', views.fare_settings_list_view, name='fare_settings_list'),
    path('fare-settings/', views.fare_settings_list_view, name='fare_settings_list_alias'),
    path('fare/estimate/', views.fare_estimate_view, name='fare_estimate'),
    path('fare/<str:vehicle_type>/', views.fare_setting_update_view, name='fare_setting_update'),
    path('fare-settings/<str:vehicle_type>/', views.fare_setting_update_view, name='fare_setting_update_alias'),
]
