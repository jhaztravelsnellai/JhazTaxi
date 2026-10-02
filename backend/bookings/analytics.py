from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Sum, Count, Avg, Q
from django.utils import timezone
from datetime import datetime, timedelta, date

from .models import Booking
from .serializers import BookingSerializer
from drivers.models import Driver
from users.models import User
from vehicles.models import Vehicle

@api_view(['GET'])
def user_dashboard_stats_view(request):
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    user = request.user
    user_bookings = Booking.objects.filter(customer=user)

    total_trips = user_bookings.count()
    completed_trips = user_bookings.filter(status='trip_completed').count()
    cancelled_trips = user_bookings.filter(status='cancelled').count()

    today = timezone.localdate() if hasattr(timezone, 'localdate') else date.today()

    # Current ongoing active ride
    current_ride = user_bookings.filter(
        status__in=['driver_assigned', 'driver_arriving', 'trip_started']
    ).select_related('driver', 'vehicle').first()

    # Next upcoming ride
    upcoming_ride = user_bookings.filter(
        status__in=['pending', 'confirmed'],
        pickup_date__gte=today
    ).select_related('driver', 'vehicle').order_by('pickup_date', 'pickup_time').first()

    recent_bookings = user_bookings.select_related('driver', 'vehicle').order_by('-created_at')[:5]

    return Response({
        'success': True,
        'stats': {
            'total_trips': total_trips,
            'completed_trips': completed_trips,
            'cancelled_trips': cancelled_trips,
            'current_ride': BookingSerializer(current_ride).data if current_ride else None,
            'upcoming_ride': BookingSerializer(upcoming_ride).data if upcoming_ride else None,
            'recent_bookings': BookingSerializer(recent_bookings, many=True).data,
        }
    })


@api_view(['GET'])
def admin_dashboard_stats_view(request):
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    today = timezone.localdate() if hasattr(timezone, 'localdate') else date.today()

    total_bookings = Booking.objects.count()
    today_bookings = Booking.objects.filter(pickup_date=today).count()
    pending_bookings = Booking.objects.filter(status='pending').count()
    confirmed_bookings = Booking.objects.filter(status__in=['confirmed', 'driver_assigned', 'driver_arriving', 'trip_started']).count()
    completed_trips = Booking.objects.filter(status='trip_completed').count()
    cancelled_trips = Booking.objects.filter(status='cancelled').count()

    total_drivers = Driver.objects.count()
    available_drivers = Driver.objects.filter(status='available').count()
    total_customers = User.objects.filter(role='customer').count()

    # Total revenue from completed trips
    revenue_agg = Booking.objects.filter(status='trip_completed').aggregate(total=Sum('total_fare'))
    total_revenue = float(revenue_agg['total'] or 0.0)

    # Last 7 Days Booking Chart
    daily_labels = []
    daily_counts = []
    daily_revenue = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime('%b %d')
        daily_labels.append(day_str)
        day_bookings = Booking.objects.filter(created_at__date=day)
        daily_counts.append(day_bookings.count())
        day_rev = day_bookings.filter(status='trip_completed').aggregate(s=Sum('total_fare'))['s'] or 0.0
        daily_revenue.append(float(day_rev))

    # Vehicle types distribution
    vehicle_types_stats = list(
        Booking.objects.values('vehicle__vehicle_type').annotate(count=Count('id')).order_by('-count')
    )

    return Response({
        'success': True,
        'stats': {
            'total_bookings': total_bookings,
            'today_bookings': today_bookings,
            'pending_bookings': pending_bookings,
            'confirmed_bookings': confirmed_bookings,
            'completed_trips': completed_trips,
            'cancelled_trips': cancelled_trips,
            'total_drivers': total_drivers,
            'available_drivers': available_drivers,
            'total_customers': total_customers,
            'total_revenue': total_revenue,
            'charts': {
                'daily_labels': daily_labels,
                'daily_counts': daily_counts,
                'daily_revenue': daily_revenue,
                'status_distribution': {
                    'completed': completed_trips,
                    'cancelled': cancelled_trips,
                    'pending': pending_bookings,
                    'confirmed': confirmed_bookings
                },
                'vehicle_types': vehicle_types_stats
            }
        }
    })


@api_view(['GET'])
def admin_reports_view(request):
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')

    queryset = Booking.objects.select_related('customer', 'driver', 'vehicle').all()

    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            queryset = queryset.filter(created_at__date__gte=start_date)
        except Exception:
            pass

    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            queryset = queryset.filter(created_at__date__lte=end_date)
        except Exception:
            pass

    total_bookings = queryset.count()
    completed_bookings = queryset.filter(status='trip_completed')
    total_revenue = float(completed_bookings.aggregate(s=Sum('total_fare'))['s'] or 0.0)
    avg_trip_fare = float(completed_bookings.aggregate(a=Avg('total_fare'))['a'] or 0.0)
    total_distance = float(completed_bookings.aggregate(d=Sum('distance_km'))['d'] or 0.0)

    # Driver Performance Report
    driver_perf = []
    drivers = Driver.objects.all()
    for d in drivers:
        d_trips = queryset.filter(driver=d)
        d_completed = d_trips.filter(status='trip_completed').count()
        d_cancelled = d_trips.filter(status='cancelled').count()
        d_rev = float(d_trips.filter(status='trip_completed').aggregate(s=Sum('total_fare'))['s'] or 0.0)
        driver_perf.append({
            'driver_id': d.id,
            'name': d.name,
            'phone': d.phone,
            'vehicle': d.vehicle.name if d.vehicle else 'N/A',
            'rating': float(d.rating),
            'completed_trips': d_completed,
            'cancelled_trips': d_cancelled,
            'revenue_generated': d_rev
        })

    # Popular Routes
    popular_routes = list(
        queryset.values('pickup_address', 'drop_address').annotate(count=Count('id')).order_by('-count')[:5]
    )

    return Response({
        'success': True,
        'report': {
            'total_bookings': total_bookings,
            'completed_trips': completed_bookings.count(),
            'cancelled_trips': queryset.filter(status='cancelled').count(),
            'total_revenue': total_revenue,
            'avg_trip_fare': round(avg_trip_fare, 2),
            'total_distance_km': round(total_distance, 2),
            'driver_performance': driver_perf,
            'popular_routes': popular_routes,
        }
    })
