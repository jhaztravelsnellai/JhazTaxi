from django.urls import path
from . import views

urlpatterns = [
    path('bookings/', views.booking_list_create_view, name='booking_list_create'),
    path('bookings/<str:pk>/', views.booking_detail_view, name='booking_detail'),
    path('bookings/<str:pk>/cancel/', views.booking_cancel_view, name='booking_cancel'),
    path('bookings/<str:pk>/assign-driver/', views.booking_assign_driver_view, name='booking_assign_driver'),
    path('bookings/<str:pk>/status/', views.booking_update_status_view, name='booking_update_status'),

    # Driver Specific URLs
    path('driver/available-bookings/', views.available_bookings_for_driver_view, name='driver_available_bookings'),
    path('driver/bookings/<str:booking_id>/request/', views.driver_request_booking_view, name='driver_request_booking'),
    path('driver/my-requests/', views.driver_my_requests_view, name='driver_my_requests'),
    path('driver/my-assigned-bookings/', views.driver_my_assigned_bookings_view, name='driver_my_assigned_bookings'),
    path('driver/bookings/<str:booking_id>/trip-status/', views.driver_update_trip_status_view, name='driver_update_trip_status'),

    # Admin Driver Request Management
    path('admin/driver-requests/', views.admin_driver_requests_list_view, name='admin_driver_requests_list'),
    path('admin/driver-requests/<int:request_id>/assign/', views.admin_assign_driver_request_view, name='admin_assign_driver_request'),
    path('admin/driver-requests/<int:request_id>/reject/', views.admin_reject_driver_request_view, name='admin_reject_driver_request'),
    path('admin/bookings/whatsapp-create/', views.admin_create_whatsapp_booking_view, name='admin_create_whatsapp_booking'),
    path('admin/bookings/publish-trip/', views.admin_create_whatsapp_booking_view, name='admin_publish_trip'),
]

