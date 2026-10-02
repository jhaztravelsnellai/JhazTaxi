from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django.db.models import Q
from .models import Driver
from .serializers import DriverSerializer

@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def driver_list_create_view(request):
    if request.method == 'GET':
        drivers = Driver.objects.select_related('vehicle').all()

        # Filters
        status_param = request.query_params.get('status')
        vehicle_type = request.query_params.get('vehicle_type')
        search = request.query_params.get('search')

        if status_param:
            drivers = drivers.filter(status=status_param)
        if vehicle_type:
            drivers = drivers.filter(vehicle__vehicle_type__iexact=vehicle_type)
        if search:
            drivers = drivers.filter(
                Q(name__icontains=search) |
                Q(phone__icontains=search) |
                Q(license_number__icontains=search) |
                Q(vehicle_number__icontains=search) |
                Q(vehicle__vehicle_number__icontains=search)
            )

        serializer = DriverSerializer(drivers, many=True, context={'request': request})
        return Response({'success': True, 'drivers': serializer.data})

    # POST (Admin only)
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DriverSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        driver = serializer.save()
        return Response({'success': True, 'message': 'Driver added successfully', 'driver': DriverSerializer(driver, context={'request': request}).data}, status=status.HTTP_201_CREATED)
    return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def driver_available_list_view(request):
    """
    List only currently available drivers, optionally filtered by vehicle type.
    """
    drivers = Driver.objects.filter(status='available').select_related('vehicle')
    v_type = request.query_params.get('vehicle_type')
    if v_type:
        drivers = drivers.filter(vehicle__vehicle_type__iexact=v_type)

    serializer = DriverSerializer(drivers, many=True, context={'request': request})
    return Response({'success': True, 'drivers': serializer.data})


@api_view(['GET', 'PUT', 'DELETE'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def driver_detail_view(request, pk):
    try:
        driver = Driver.objects.select_related('vehicle').get(pk=pk)
    except Driver.DoesNotExist:
        return Response({'success': False, 'message': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'success': True, 'driver': DriverSerializer(driver, context={'request': request}).data})

    # PUT/DELETE require admin permissions
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        serializer = DriverSerializer(driver, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated = serializer.save()
            return Response({'success': True, 'message': 'Driver updated successfully', 'driver': DriverSerializer(updated, context={'request': request}).data})
        return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        driver.delete()
        return Response({'success': True, 'message': 'Driver deleted successfully'})


@api_view(['PATCH'])
def driver_update_status_view(request, pk):
    try:
        driver = Driver.objects.get(pk=pk)
    except Driver.DoesNotExist:
        return Response({'success': False, 'message': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    if new_status not in ['available', 'on_trip', 'offline']:
        return Response({'success': False, 'message': 'Invalid driver status'}, status=status.HTTP_400_BAD_REQUEST)

    driver.status = new_status
    if 'current_latitude' in request.data:
        driver.current_latitude = request.data['current_latitude']
    if 'current_longitude' in request.data:
        driver.current_longitude = request.data['current_longitude']
    driver.save()

    return Response({'success': True, 'message': f'Driver status set to {new_status}', 'driver': DriverSerializer(driver).data})


@api_view(['GET'])
def driver_map_locations_view(request):
    """
    Returns real coordinates of all active drivers for Leaflet Admin Map.
    """
    drivers = Driver.objects.select_related('vehicle').all()
    data = []
    for d in drivers:
        data.append({
            'id': d.id,
            'name': d.name,
            'phone': d.phone,
            'status': d.status,
            'rating': float(d.rating),
            'lat': float(d.current_latitude),
            'lng': float(d.current_longitude),
            'vehicle': {
                'name': d.vehicle.name if d.vehicle else 'N/A',
                'number': d.vehicle.vehicle_number if d.vehicle else 'N/A',
                'type': d.vehicle.vehicle_type if d.vehicle else 'Sedan',
            }
        })
    return Response({'success': True, 'drivers': data})


@api_view(['GET'])
def driver_profile_view(request):
    """
    Get current logged-in driver's profile, car photo, and vehicle details.
    """
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    driver = Driver.objects.filter(user=request.user).first()
    if not driver:
        driver = Driver.objects.filter(Q(email__iexact=request.user.email) | Q(phone=request.user.phone_number)).first()

    if not driver:
        return Response({'success': False, 'message': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

    return Response({'success': True, 'driver': DriverSerializer(driver, context={'request': request}).data})

