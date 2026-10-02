import mimetypes
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse, Http404, FileResponse
from django.conf import settings
from django.conf.urls.static import static

from users.views import admin_customers_list_view, admin_customer_toggle_status_view
from bookings.analytics import (
    admin_dashboard_stats_view, admin_reports_view, user_dashboard_stats_view,
    admin_archive_stats_view, admin_export_archive_csv_view, admin_purge_archive_view
)

def health_check(request):
    return JsonResponse({
        'status': 'healthy',
        'application': 'JhazTaxi API',
        'version': '1.0.0',
        'database': 'operational'
    })

FRONTEND_DIR = settings.BASE_DIR.parent / 'frontend'

def serve_frontend(request, resource_path=''):
    clean_path = resource_path.strip('/')
    if not clean_path:
        target = FRONTEND_DIR / 'index.html'
    else:
        target = (FRONTEND_DIR / clean_path).resolve()
        # Security: ensure file is inside FRONTEND_DIR
        try:
            target.relative_to(FRONTEND_DIR.resolve())
        except ValueError:
            raise Http404("Forbidden")

        if target.is_dir():
            target = target / 'index.html'
        elif not target.exists():
            # Support clean URLs: e.g. /login -> /login.html
            html_candidate = target.with_suffix('.html')
            if html_candidate.exists():
                target = html_candidate

    if not target.exists() or not target.is_file():
        raise Http404(f"Resource not found: {resource_path}")

    content_type, _ = mimetypes.guess_type(str(target))
    if not content_type:
        if target.suffix == '.js':
            content_type = 'application/javascript'
        elif target.suffix == '.css':
            content_type = 'text/css'
        elif target.suffix == '.svg':
            content_type = 'image/svg+xml'
        elif target.suffix in ['.json', '.webmanifest']:
            content_type = 'application/json'
        else:
            content_type = 'application/octet-stream'

    response = FileResponse(open(target, 'rb'), content_type=content_type)
    if target.suffix in ['.css', '.js', '.svg', '.png', '.jpg', '.ico', '.woff2']:
        response['Cache-Control'] = 'public, max-age=86400'
    return response

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/health/', health_check, name='api_health'),

    # Auth & Profile
    path('api/auth/', include('users.urls')),

    # Admin Specific Views
    path('api/admin/dashboard-stats/', admin_dashboard_stats_view, name='admin_dashboard_stats'),
    path('api/admin/reports/', admin_reports_view, name='admin_reports'),
    path('api/admin/reports/archive-stats/', admin_archive_stats_view, name='admin_archive_stats'),
    path('api/admin/reports/archive-export/', admin_export_archive_csv_view, name='admin_archive_export'),
    path('api/admin/reports/archive-purge/', admin_purge_archive_view, name='admin_archive_purge'),
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

from django.views.static import serve

# Media files serving (GPay QR code, driver photos, vehicles)
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

# Catch-all frontend route to serve HTML, CSS, JS directly under the SAME single URL!
urlpatterns += [
    re_path(r'^(?P<resource_path>.*)$', serve_frontend, name='frontend_app'),
]
