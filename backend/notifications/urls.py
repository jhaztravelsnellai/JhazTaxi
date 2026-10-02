from django.urls import path
from . import views

urlpatterns = [
    path('notifications/', views.notification_list_view, name='notification_list'),
    path('notifications/mark-read/', views.notification_mark_read_view, name='notification_mark_read'),
]
