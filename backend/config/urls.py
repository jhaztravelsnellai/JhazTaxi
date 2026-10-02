from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from users.views import admin_customers_list_view, admin_customer_toggle_status_view
from bookings.analytics import admin_dashboard_stats_view, admin_reports_view, user_dashboard_stats_view

def health_check(request):
    return JsonResponse({
        'status': 'healthy',
        'application': 'JhazTaxi API',
        'version': '1.0.0',
        'database': 'operational'
    })

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('', health_check, name='root_health'),
    path('api/health/', health_check, name='api_health'),

    # Auth & Profile
    path('api/auth/', include('users.urls')),

    # Admin Specific Views
    path('api/admin/dashboard-stats/', admin_dashboard_stats_view, name='admin_dashboard_stats'),
    path('api/admin/reports/', admin_reports_view, name='admin_reports'),
    path('api/admin/customers/', admin_customers_list_view, name='admin_customers_list'),
    path('api/admin/customers/<int:customer_id>/toggle-status/', admin_customer_toggle_status_view, name='admin_customer_toggle'),

    # User Dashboard Stats
    path('api/user/dashboard-stats/', user_dashboard_stats_view, name='user_dashboard_stats'),

    # Resource APIs
    path('api/', include('vehicles.urls')),
    path('api/', include('drivers.urls')),
    path('api/', include('bookings.urls')),
    path('api/', include('payments.urls')),
    path('api/', include('reviews.urls')),
    path('api/', include('notifications.urls')),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
