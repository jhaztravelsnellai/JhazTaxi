from django.urls import path
from . import views

urlpatterns = [
    path('payments/', views.payment_list_create_view, name='payment_list_create'),
]
