from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from decimal import Decimal
from datetime import datetime, date

from .models import Booking, DriverBookingRequest
from .serializers import BookingSerializer, DriverBookingRequestSerializer
from vehicles.models import Vehicle, FareSetting
from drivers.models import Driver
from notifications.models import Notification
from payments.models import Payment
from users.models import User

@api_view(['GET', 'POST'])
def booking_list_create_view(request):
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required to access bookings'}, status=status.HTTP_401_UNAUTHORIZED)

    # GET Bookings
    if request.method == 'GET':
        user = request.user
        queryset = Booking.objects.select_related('customer', 'driver', 'vehicle').all()

        # If regular customer, show only their bookings
        if user.role == 'customer' and not user.is_staff:
            queryset = queryset.filter(customer=user)
        else:
            # Admin filters
            status_param = request.query_params.get('status')
            filter_type = request.query_params.get('filter')  # 'today', 'upcoming'
            search = request.query_params.get('search')

            today = timezone.localdate() if hasattr(timezone, 'localdate') else date.today()

            if status_param and status_param != 'all':
                queryset = queryset.filter(status=status_param)

            if filter_type == 'today':
                queryset = queryset.filter(pickup_date=today)
            elif filter_type == 'upcoming':
                queryset = queryset.filter(pickup_date__gte=today).exclude(status__in=['trip_completed', 'cancelled'])

            if search:
                queryset = queryset.filter(
                    Q(booking_id__icontains=search) |
                    Q(customer__first_name__icontains=search) |
                    Q(customer__last_name__icontains=search) |
                    Q(customer__email__icontains=search) |
                    Q(pickup_address__icontains=search) |
                    Q(drop_address__icontains=search) |
                    Q(driver__name__icontains=search)
                )

        serializer = BookingSerializer(queryset, many=True)
        return Response({'success': True, 'bookings': serializer.data})

    # POST - Create New Booking
    data = request.data
    vehicle_id = data.get('vehicle_id') or data.get('vehicle')
    vehicle = None
    if vehicle_id:
        try:
            vehicle = Vehicle.objects.get(id=vehicle_id)
        except Vehicle.DoesNotExist:
            return Response({'success': False, 'message': 'Selected vehicle does not exist'}, status=status.HTTP_404_NOT_FOUND)
    elif data.get('vehicle_type'):
        vehicle = Vehicle.objects.filter(vehicle_type__iexact=data.get('vehicle_type'), status='available').first() or \
                  Vehicle.objects.filter(vehicle_type__iexact=data.get('vehicle_type')).first()

    if not vehicle:
        return Response({'success': False, 'message': 'Vehicle is required (specify vehicle_id or vehicle_type)'}, status=status.HTTP_400_BAD_REQUEST)

    # Distance and Duration
    try:
        distance_km = Decimal(str(data.get('distance_km', 10.0)))
        duration_mins = int(data.get('duration_mins', 20))
    except Exception:
        return Response({'success': False, 'message': 'Invalid distance or duration format'}, status=status.HTTP_400_BAD_REQUEST)

    passengers = int(data.get('passengers', 1))
    pickup_date = data.get('pickup_date') or str(date.today())
    pickup_time = data.get('pickup_time') or '12:00'

    # Retrieve dynamic FareSetting from DB
    fare_setting = FareSetting.objects.filter(vehicle_type=vehicle.vehicle_type, is_active=True).first()
    if fare_setting:
        base_fare = fare_setting.base_fare
        price_per_km = fare_setting.price_per_km
        min_fare = fare_setting.min_fare
        waiting_charge = Decimal('0.00')
        night_percent = fare_setting.night_charge_percent
        extra_pass_charge = fare_setting.additional_passenger_charge
    else:
        base_fare = vehicle.base_fare
        price_per_km = vehicle.price_per_km
        min_fare = Decimal('80.00')
        waiting_charge = Decimal('0.00')
        night_percent = Decimal('15.00')
        extra_pass_charge = Decimal('20.00')

    distance_fare = distance_km * price_per_km

    # Night surcharge if between 22:00 and 06:00
    night_charge = Decimal('0.00')
    try:
        pt = datetime.strptime(pickup_time[:5], '%H:%M').time()
        if pt.hour >= 22 or pt.hour < 6:
            night_charge = (base_fare + distance_fare) * (night_percent / Decimal('100.00'))
    except Exception:
        pass

    # Extra passenger surcharge
    std_cap = 6 if vehicle.vehicle_type == 'SUV' else 4
    additional_passenger_charge = Decimal('0.00')
    if passengers > std_cap:
        additional_passenger_charge = Decimal(str(passengers - std_cap)) * extra_pass_charge

    total_fare = base_fare + distance_fare + waiting_charge + night_charge + additional_passenger_charge
    if total_fare < min_fare:
        total_fare = min_fare

    booking = Booking.objects.create(
        customer=request.user,
        vehicle=vehicle,
        pickup_address=data.get('pickup_address', 'Pickup Location'),
        pickup_lat=data.get('pickup_lat'),
        pickup_lng=data.get('pickup_lng'),
        drop_address=data.get('drop_address', 'Destination Location'),
        drop_lat=data.get('drop_lat'),
        drop_lng=data.get('drop_lng'),
        pickup_date=pickup_date,
        pickup_time=pickup_time,
        passengers=passengers,
        distance_km=distance_km,
        duration_mins=duration_mins,
        base_fare=base_fare,
        price_per_km=price_per_km,
        distance_fare=distance_fare,
        waiting_charge=waiting_charge,
        night_charge=night_charge,
        additional_passenger_charge=additional_passenger_charge,
        total_fare=round(total_fare, 2),
        payment_method=data.get('payment_method', 'cash'),
        payment_status='pending',
        status='pending',
        customer_notes=data.get('customer_notes', '')
    )

    # Automatically create Payment record
    Payment.objects.create(
        booking=booking,
        amount=booking.total_fare,
        payment_method=booking.payment_method,
        payment_status='pending'
    )

    # Customer notification
    Notification.objects.create(
        user=request.user,
        booking=booking,
        title="Booking Request Received",
        message=f"Your ride request {booking.booking_id} has been placed. Waiting for driver assignment.",
        notification_type='booking_created'
    )

    # Admin notifications
    admins = User.objects.filter(Q(role='admin') | Q(is_staff=True))
    for adm in admins:
        Notification.objects.create(
            user=adm,
            booking=booking,
            title=f"New Booking: {booking.booking_id}",
            message=f"New booking from {request.user.get_full_name() or request.user.username} for {vehicle.vehicle_type} (Rs.{booking.total_fare}).",
            notification_type='booking_created'
        )

    return Response({
        'success': True,
        'message': f'Booking created successfully! Your Booking ID is {booking.booking_id}',
        'booking': BookingSerializer(booking).data
    }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'DELETE'])
def booking_detail_view(request, pk):
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        # pk can be integer ID or booking_id string (e.g. JHZ-000001)
        if str(pk).isdigit():
            booking = Booking.objects.select_related('customer', 'driver', 'vehicle').get(pk=pk)
        else:
            booking = Booking.objects.select_related('customer', 'driver', 'vehicle').get(booking_id__iexact=str(pk))
    except Booking.DoesNotExist:
        return Response({'success': False, 'message': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

    # Permission check: customer can only see their own booking, unless admin/staff
    if request.user.role == 'customer' and not request.user.is_staff and booking.customer != request.user:
        return Response({'success': False, 'message': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response({'success': True, 'booking': BookingSerializer(booking).data})

    if request.method == 'DELETE':
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)
        booking.delete()
        return Response({'success': True, 'message': 'Booking deleted successfully'})


@api_view(['POST'])
def booking_cancel_view(request, pk):
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        if str(pk).isdigit():
            booking = Booking.objects.get(pk=pk)
        else:
            booking = Booking.objects.get(booking_id__iexact=str(pk))
    except Booking.DoesNotExist:
        return Response({'success': False, 'message': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

    # Security check
    if request.user.role == 'customer' and not request.user.is_staff and booking.customer != request.user:
        return Response({'success': False, 'message': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    if booking.status in ['trip_completed', 'cancelled']:
        return Response({'success': False, 'message': f'Cannot cancel a booking that is already {booking.status}'}, status=status.HTTP_400_BAD_REQUEST)

    reason = request.data.get('reason', 'Cancelled by user')
    booking.status = 'cancelled'
    booking.cancellation_reason = reason

    # Free up driver if assigned
    if booking.driver:
        booking.driver.status = 'available'
        booking.driver.save(update_fields=['status'])

    booking.save()

    # Create notification
    Notification.objects.create(
        user=booking.customer,
        booking=booking,
        title=f"Booking Cancelled: {booking.booking_id}",
        message=f"Your ride has been cancelled. Reason: {reason}",
        notification_type='booking_cancelled'
    )

    return Response({
        'success': True,
        'message': 'Booking cancelled successfully',
        'booking': BookingSerializer(booking).data
    })


@api_view(['POST'])
def booking_assign_driver_view(request, pk):
    """
    Admin assigns an available driver to a booking.
    """
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        if str(pk).isdigit():
            booking = Booking.objects.get(pk=pk)
        else:
            booking = Booking.objects.get(booking_id__iexact=str(pk))
    except Booking.DoesNotExist:
        return Response({'success': False, 'message': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

    driver_id = request.data.get('driver_id')
    if not driver_id:
        return Response({'success': False, 'message': 'driver_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        driver = Driver.objects.get(id=driver_id)
    except Driver.DoesNotExist:
        return Response({'success': False, 'message': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

    if driver.status != 'available':
        return Response({'success': False, 'message': f'Driver {driver.name} is currently {driver.status}. Only available drivers can be assigned.'}, status=status.HTTP_400_BAD_REQUEST)

    # Free previous driver if any
    if booking.driver and booking.driver != driver:
        booking.driver.status = 'available'
        booking.driver.save(update_fields=['status'])

    booking.driver = driver
    booking.status = 'driver_assigned'
    booking.save()

    # Update driver to on_trip
    driver.status = 'on_trip'
    driver.save(update_fields=['status'])

    # Send Notification to Customer
    Notification.objects.create(
        user=booking.customer,
        booking=booking,
        title="Driver Assigned!",
        message=f"Driver {driver.name} ({driver.phone}) has been assigned to your booking {booking.booking_id}.",
        notification_type='driver_assigned'
    )

    return Response({
        'success': True,
        'message': f'Driver {driver.name} assigned successfully',
        'booking': BookingSerializer(booking).data
    })


@api_view(['POST'])
def booking_update_status_view(request, pk):
    """
    Update booking lifecycle:
    pending -> confirmed -> driver_assigned -> driver_arriving -> trip_started -> trip_completed -> cancelled
    """
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        if str(pk).isdigit():
            booking = Booking.objects.get(pk=pk)
        else:
            booking = Booking.objects.get(booking_id__iexact=str(pk))
    except Booking.DoesNotExist:
        return Response({'success': False, 'message': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    valid_statuses = [s[0] for s in Booking.STATUS_CHOICES]
    if new_status not in valid_statuses:
        return Response({'success': False, 'message': f'Invalid status. Allowed: {valid_statuses}'}, status=status.HTTP_400_BAD_REQUEST)

    booking.status = new_status

    # Lifecycle side-effects
    if new_status == 'trip_completed':
        if booking.driver:
            booking.driver.status = 'available'
            booking.driver.save(update_fields=['status'])
        
        # Mark payment completed if cash on ride
        booking.payment_status = 'paid'
        Payment.objects.filter(booking=booking).update(payment_status='completed')

        Notification.objects.create(
            user=booking.customer,
            booking=booking,
            title="Trip Completed!",
            message=f"You have arrived safely at your destination. Please leave a rating for your driver {booking.driver.name if booking.driver else ''}.",
            notification_type='trip_completed'
        )

    elif new_status == 'driver_arriving':
        Notification.objects.create(
            user=booking.customer,
            booking=booking,
            title="Driver is Arriving",
            message=f"Your driver is arriving at your pickup location shortly.",
            notification_type='driver_arriving'
        )

    elif new_status == 'trip_started':
        Notification.objects.create(
            user=booking.customer,
            booking=booking,
            title="Trip Started",
            message=f"Your ride to {booking.drop_address} is in progress. Have a safe journey!",
            notification_type='trip_started'
        )

    elif new_status == 'cancelled':
        if booking.driver:
            booking.driver.status = 'available'
            booking.driver.save(update_fields=['status'])
        booking.cancellation_reason = request.data.get('reason', 'Cancelled by administrator')

    booking.save()

    return Response({
        'success': True,
        'message': f'Booking status updated to {new_status}',
        'booking': BookingSerializer(booking).data
    })


# ==============================================================================
# DRIVER WORKFLOW VIEWS (Driver Request vs Admin Assignment)
# ==============================================================================

def get_driver_profile_for_user(user):
    """Helper to locate Driver profile linked to user"""
    if hasattr(user, 'driver_profile') and user.driver_profile:
        return user.driver_profile
    return Driver.objects.filter(Q(email=user.email) | Q(phone=user.phone_number)).first()


@api_view(['GET'])
def available_bookings_for_driver_view(request):
    """
    Returns unassigned/available bookings for drivers to view and request.
    Only shows bookings that have no driver assigned yet.
    """
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if request.user.role not in ['driver', 'admin'] and not request.user.is_staff:
        return Response({'success': False, 'message': 'Driver access required'}, status=status.HTTP_403_FORBIDDEN)

    bookings = Booking.objects.filter(
        driver__isnull=True,
        status__in=['pending', 'confirmed']
    ).select_related('customer', 'vehicle').prefetch_related('driver_requests').order_by('-created_at')

    serializer = BookingSerializer(bookings, many=True, context={'request': request})
    return Response({
        'success': True,
        'count': bookings.count(),
        'bookings': serializer.data
    })


@api_view(['POST'])
def driver_request_booking_view(request, booking_id):
    """
    Driver clicks 'I Can Take This Booking'
    Creates a DriverBookingRequest with status='pending'.
    Does NOT assign the driver directly.
    """
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    driver = get_driver_profile_for_user(request.user)
    if not driver:
        return Response({'success': False, 'message': 'You must have an active Driver profile to request bookings.'}, status=status.HTTP_403_FORBIDDEN)

    # Locate booking
    try:
        if str(booking_id).isdigit():
            booking = Booking.objects.select_related('customer').get(pk=booking_id)
        else:
            booking = Booking.objects.select_related('customer').get(booking_id__iexact=str(booking_id))
    except Booking.DoesNotExist:
        return Response({'success': False, 'message': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Check if booking is still available
    if booking.driver is not None or booking.status not in ['pending', 'confirmed']:
        return Response({
            'success': False,
            'message': 'This booking has already been assigned to a driver or is no longer available.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Prevent duplicate requests from same driver
    existing_req = DriverBookingRequest.objects.filter(booking=booking, driver=driver).first()
    if existing_req:
        return Response({
            'success': False,
            'message': f"You have already submitted a request for this booking. Current Status: {existing_req.get_status_display()}."
        }, status=status.HTTP_400_BAD_REQUEST)

    driver_note = request.data.get('driver_note', '') or request.data.get('note', '')

    driver_req = DriverBookingRequest.objects.create(
        booking=booking,
        driver=driver,
        status='pending',
        driver_note=driver_note
    )

    # Notify Admins
    admins = User.objects.filter(Q(role='admin') | Q(is_staff=True))
    for adm in admins:
        Notification.objects.create(
            user=adm,
            booking=booking,
            title=f"Driver Request: {driver.name}",
            message=f"Driver {driver.name} ({driver.phone}) requested booking {booking.booking_id} ({booking.pickup_address} -> {booking.drop_address}).",
            notification_type='driver_request'
        )

    return Response({
        'success': True,
        'message': f"Your request to take booking {booking.booking_id} has been submitted for Admin approval.",
        'request': DriverBookingRequestSerializer(driver_req, context={'request': request}).data
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def driver_my_requests_view(request):
    """Returns all booking requests made by the logged-in driver"""
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    driver = get_driver_profile_for_user(request.user)
    if not driver:
        return Response({'success': False, 'message': 'Driver profile not found'}, status=status.HTTP_403_FORBIDDEN)

    requests_qs = DriverBookingRequest.objects.filter(driver=driver).select_related(
        'booking', 'booking__customer', 'booking__vehicle'
    ).order_by('-created_at')

    return Response({
        'success': True,
        'requests': DriverBookingRequestSerializer(requests_qs, many=True, context={'request': request}).data
    })


@api_view(['GET'])
def driver_my_assigned_bookings_view(request):
    """Returns trips officially assigned to the logged-in driver"""
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    driver = get_driver_profile_for_user(request.user)
    if not driver:
        return Response({'success': False, 'message': 'Driver profile not found'}, status=status.HTTP_403_FORBIDDEN)

    bookings = Booking.objects.filter(driver=driver).select_related('customer', 'vehicle').order_by('-created_at')
    return Response({
        'success': True,
        'bookings': BookingSerializer(bookings, many=True, context={'request': request}).data
    })


@api_view(['POST'])
def driver_update_trip_status_view(request, booking_id):
    """Assigned driver starts or completes their ride"""
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    driver = get_driver_profile_for_user(request.user)
    try:
        if str(booking_id).isdigit():
            booking = Booking.objects.select_related('customer', 'driver').get(pk=booking_id)
        else:
            booking = Booking.objects.select_related('customer', 'driver').get(booking_id__iexact=str(booking_id))
    except Booking.DoesNotExist:
        return Response({'success': False, 'message': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

    # Permission check: must be assigned driver or admin
    if not request.user.is_staff and request.user.role != 'admin' and booking.driver != driver:
        return Response({'success': False, 'message': 'You are not assigned to this booking'}, status=status.HTTP_403_FORBIDDEN)

    new_status = request.data.get('status')
    if new_status not in ['driver_arriving', 'trip_started', 'trip_completed']:
        return Response({'success': False, 'message': 'Invalid trip status'}, status=status.HTTP_400_BAD_REQUEST)

    booking.status = new_status
    if new_status == 'trip_completed':
        booking.payment_status = 'paid'
        Payment.objects.filter(booking=booking).update(payment_status='completed')
        if booking.driver:
            booking.driver.status = 'available'
            booking.driver.save(update_fields=['status'])
        Notification.objects.create(
            user=booking.customer,
            booking=booking,
            title="Trip Completed!",
            message=f"You have arrived safely. Please leave a rating for driver {booking.driver.name if booking.driver else ''}.",
            notification_type='trip_completed'
        )
    elif new_status == 'trip_started':
        Notification.objects.create(
            user=booking.customer,
            booking=booking,
            title="Trip Started",
            message=f"Your ride with {booking.driver.name if booking.driver else 'driver'} is now in progress.",
            notification_type='trip_started'
        )

    booking.save()
    return Response({
        'success': True,
        'message': f"Trip status updated to {new_status}",
        'booking': BookingSerializer(booking, context={'request': request}).data
    })


# ==============================================================================
# ADMIN DRIVER REQUEST MANAGEMENT VIEWS
# ==============================================================================

@api_view(['GET'])
def admin_driver_requests_list_view(request):
    """Admin views all driver booking requests with status filter"""
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    status_filter = request.query_params.get('status')
    booking_id_filter = request.query_params.get('booking_id')

    queryset = DriverBookingRequest.objects.select_related(
        'booking', 'booking__customer', 'booking__vehicle', 'driver', 'driver__vehicle'
    ).all()

    if status_filter and status_filter != 'all':
        queryset = queryset.filter(status=status_filter)
    if booking_id_filter:
        queryset = queryset.filter(booking__booking_id__iexact=booking_id_filter)

    return Response({
        'success': True,
        'count': queryset.count(),
        'requests': DriverBookingRequestSerializer(queryset, many=True, context={'request': request}).data
    })


@api_view(['POST'])
def admin_assign_driver_request_view(request, request_id):
    """
    Admin reviews and approves a Driver's request to take a booking.
    Officially assigns the booking to this driver.
    Auto-rejects other pending requests for the same booking.
    """
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        driver_req = DriverBookingRequest.objects.select_related('booking', 'driver', 'booking__customer').get(pk=request_id)
    except DriverBookingRequest.DoesNotExist:
        return Response({'success': False, 'message': 'Driver request not found'}, status=status.HTTP_404_NOT_FOUND)

    booking = driver_req.booking
    driver = driver_req.driver

    # Officially assign driver to booking
    booking.driver = driver
    booking.status = 'driver_assigned'
    booking.save()

    # Update driver status
    driver.status = 'on_trip'
    driver.save(update_fields=['status'])

    # Approve this request
    driver_req.status = 'approved'
    driver_req.reviewed_at = timezone.now()
    driver_req.admin_notes = request.data.get('notes', 'Approved by Admin')
    driver_req.save()

    # Automatically reject/cancel all other pending requests for this same booking
    other_requests = DriverBookingRequest.objects.filter(booking=booking, status='pending').exclude(id=driver_req.id)
    for other_req in other_requests:
        other_req.status = 'rejected'
        other_req.reviewed_at = timezone.now()
        other_req.admin_notes = 'Assigned to another driver'
        other_req.save()

        # Notify other driver
        if other_req.driver.user:
            Notification.objects.create(
                user=other_req.driver.user,
                booking=booking,
                title="Booking Assigned to Another Driver",
                message=f"Booking {booking.booking_id} was assigned to another driver. Keep looking for other available rides!",
                notification_type='request_rejected'
            )

    # Notify approved driver
    if driver.user:
        Notification.objects.create(
            user=driver.user,
            booking=booking,
            title="Booking Assigned to You!",
            message=f"Admin approved your request for booking {booking.booking_id}. Please proceed to pickup at {booking.pickup_address}.",
            notification_type='booking_assigned'
        )

    # Notify customer
    Notification.objects.create(
        user=booking.customer,
        booking=booking,
        title="Driver Assigned to Your Ride",
        message=f"Driver {driver.name} ({driver.phone}) has been assigned to your booking {booking.booking_id}.",
        notification_type='driver_assigned'
    )

    return Response({
        'success': True,
        'message': f"Booking {booking.booking_id} officially assigned to driver {driver.name}!",
        'booking': BookingSerializer(booking, context={'request': request}).data,
        'request': DriverBookingRequestSerializer(driver_req, context={'request': request}).data
    })


@api_view(['POST'])
def admin_reject_driver_request_view(request, request_id):
    """Admin rejects a driver's request. Booking remains available."""
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        driver_req = DriverBookingRequest.objects.select_related('booking', 'driver').get(pk=request_id)
    except DriverBookingRequest.DoesNotExist:
        return Response({'success': False, 'message': 'Driver request not found'}, status=status.HTTP_404_NOT_FOUND)

    driver_req.status = 'rejected'
    driver_req.reviewed_at = timezone.now()
    driver_req.admin_notes = request.data.get('notes', 'Declined by Admin')
    driver_req.save()

    # Notify driver
    if driver_req.driver.user:
        Notification.objects.create(
            user=driver_req.driver.user,
            booking=driver_req.booking,
            title="Driver Request Declined",
            message=f"Your request for booking {driver_req.booking.booking_id} was declined by Admin.",
            notification_type='request_rejected'
        )

    return Response({
        'success': True,
        'message': f"Driver request from {driver_req.driver.name} rejected.",
        'request': DriverBookingRequestSerializer(driver_req, context={'request': request}).data
    })


@api_view(['POST'])
def admin_create_whatsapp_booking_view(request):
    """
    Admin manually creates a booking received via WhatsApp or Phone call.
    Instantly enters the pool as 'pending' with no driver assigned,
    so drivers can see it and request it.
    """
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    cust_name = data.get('customer_name', 'WhatsApp Customer').strip()
    cust_phone = data.get('customer_phone', '').strip()
    pickup_addr = data.get('pickup_address', '').strip()
    drop_addr = data.get('drop_address', '').strip()
    v_type = data.get('vehicle_type', 'Sedan')

    if not pickup_addr or not drop_addr:
        return Response({'success': False, 'message': 'Pickup and drop addresses are required'}, status=status.HTTP_400_BAD_REQUEST)

    # Find or create a user representation for this WhatsApp customer
    cust_email = data.get('customer_email') or f"wa_{cust_phone.replace('+', '').replace(' ', '') or 'cust'}@whatsapp.jhaztaxi.com"
    customer_user, _ = User.objects.get_or_create(
        email=cust_email,
        defaults={
            'username': f"wa_{cust_phone[-6:] if len(cust_phone)>=6 else 'user'}",
            'first_name': cust_name,
            'phone_number': cust_phone,
            'role': 'customer'
        }
    )

    # Resolve vehicle
    vehicle = Vehicle.objects.filter(vehicle_type__iexact=v_type, status='available').first() or \
              Vehicle.objects.filter(vehicle_type__iexact=v_type).first() or \
              Vehicle.objects.first()

    dist = Decimal(str(data.get('distance_km', 10.0)))
    total_fare = Decimal(str(data.get('total_fare', 250.0)))

    # Optional direct assignment to specific driver
    driver_id = data.get('driver_id')
    selected_driver = None
    if driver_id:
        try:
            selected_driver = Driver.objects.get(pk=driver_id)
        except (Driver.DoesNotExist, ValueError):
            selected_driver = None

    booking_status = 'driver_assigned' if selected_driver else 'pending'
    pay_method = data.get('payment_method', 'cash')
    if pay_method not in ['cash', 'upi', 'gpay']:
        pay_method = 'cash'

    booking = Booking.objects.create(
        customer=customer_user,
        vehicle=vehicle,
        driver=selected_driver,
        pickup_address=pickup_addr,
        pickup_lat=data.get('pickup_lat', 12.9716),
        pickup_lng=data.get('pickup_lng', 77.5946),
        drop_address=drop_addr,
        drop_lat=data.get('drop_lat', 12.9352),
        drop_lng=data.get('drop_lng', 77.6245),
        pickup_date=data.get('pickup_date') or str(date.today()),
        pickup_time=data.get('pickup_time') or '12:00',
        passengers=int(data.get('passengers', 1)),
        distance_km=dist,
        duration_mins=int(data.get('duration_mins', 25)),
        base_fare=Decimal('100.00'),
        price_per_km=Decimal('15.00'),
        distance_fare=dist * Decimal('15.00'),
        total_fare=total_fare,
        payment_method=pay_method,
        payment_status='pending',
        status=booking_status,
        customer_notes=f"Trip: {cust_name} ({cust_phone}). {data.get('customer_notes', '')}".strip()
    )

    if selected_driver:
        selected_driver.status = 'on_trip'
        selected_driver.save(update_fields=['status'])
        if selected_driver.user:
            Notification.objects.create(
                user=selected_driver.user,
                booking=booking,
                title="Direct Trip Assigned by Admin",
                message=f"Admin assigned Trip {booking.booking_id} directly to you. Pickup: {booking.pickup_address} at {booking.pickup_time}.",
                notification_type='booking_assigned'
            )
        success_msg = f"Trip {booking.booking_id} created and directly assigned to Driver {selected_driver.name}!"
    else:
        success_msg = f"Trip {booking.booking_id} published successfully and added to available pool for drivers!"

    Payment.objects.create(
        booking=booking,
        amount=booking.total_fare,
        payment_method=booking.payment_method,
        payment_status='pending'
    )

    return Response({
        'success': True,
        'message': success_msg,
        'booking': BookingSerializer(booking, context={'request': request}).data
    }, status=status.HTTP_201_CREATED)

