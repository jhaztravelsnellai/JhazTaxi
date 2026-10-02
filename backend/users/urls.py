from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_view, name='auth_register'),
    path('login/', views.login_view, name='auth_login'),
    path('driver-register/', views.driver_register_view, name='auth_driver_register'),
    path('driver-login/', views.driver_login_view, name='auth_driver_login'),
    path('admin-login/', views.admin_login_view, name='auth_admin_login'),
    path('logout/', views.logout_view, name='auth_logout'),
    path('profile/', views.profile_view, name='auth_profile'),
]
