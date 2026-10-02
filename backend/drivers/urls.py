from django.urls import path
from . import views

urlpatterns = [
    path('drivers/', views.driver_list_create_view, name='driver_list_create'),
    path('drivers/available/', views.driver_available_list_view, name='driver_available_list'),
    path('drivers/locations/', views.driver_map_locations_view, name='driver_map_locations'),
    path('drivers/<int:pk>/', views.driver_detail_view, name='driver_detail'),
    path('drivers/<int:pk>/status/', views.driver_update_status_view, name='driver_update_status'),
    path('driver/profile/', views.driver_profile_view, name='driver_profile'),
]
