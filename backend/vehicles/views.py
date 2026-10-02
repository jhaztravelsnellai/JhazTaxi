from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from decimal import Decimal
from datetime import datetime
from .models import Vehicle, FareSetting
from .serializers import VehicleSerializer, FareSettingSerializer

@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def vehicle_list_create_view(request):
    if request.method == 'GET':
        vehicles = Vehicle.objects.all()
        # Optional filter by type or status
        v_type = request.query_params.get('type')
        v_status = request.query_params.get('status')
        if v_type:
            vehicles = vehicles.filter(vehicle_type__iexact=v_type)
        if v_status:
            vehicles = vehicles.filter(status=v_status)
        
        serializer = VehicleSerializer(vehicles, many=True, context={'request': request})
        return Response({'success': True, 'vehicles': serializer.data})

    # POST (Admin only)
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    serializer = VehicleSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        vehicle = serializer.save()
        return Response({'success': True, 'message': 'Vehicle added successfully', 'vehicle': VehicleSerializer(vehicle, context={'request': request}).data}, status=status.HTTP_201_CREATED)
    return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def vehicle_detail_view(request, pk):
    try:
        vehicle = Vehicle.objects.get(pk=pk)
    except Vehicle.DoesNotExist:
        return Response({'success': False, 'message': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'success': True, 'vehicle': VehicleSerializer(vehicle, context={'request': request}).data})

    # PUT/DELETE require admin permissions
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        serializer = VehicleSerializer(vehicle, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated = serializer.save()
            return Response({'success': True, 'message': 'Vehicle updated successfully', 'vehicle': VehicleSerializer(updated, context={'request': request}).data})
        return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        vehicle.delete()
        return Response({'success': True, 'message': 'Vehicle deleted successfully'})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def fare_settings_list_view(request):
    fares = FareSetting.objects.filter(is_active=True)
    serializer = FareSettingSerializer(fares, many=True)
    return Response({'success': True, 'fares': serializer.data})


@api_view(['PUT'])
def fare_setting_update_view(request, vehicle_type):
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        fare = FareSetting.objects.get(vehicle_type__iexact=vehicle_type)
    except FareSetting.DoesNotExist:
        return Response({'success': False, 'message': 'Fare setting for vehicle type not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = FareSettingSerializer(fare, data=request.data, partial=True)
    if serializer.is_valid():
        updated = serializer.save()
        return Response({'success': True, 'message': f'Fare settings for {vehicle_type} updated', 'fare': FareSettingSerializer(updated).data})
    return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def fare_estimate_view(request):
    """
    Dynamic fare calculation endpoint.
    Calculates exact fare based on DB FareSetting:
    Formula: Total Fare = Base Fare + (Distance * Price/KM) + Waiting Charge + Night Charge + Extra Passenger Charge
    """
    distance_km = request.data.get('distance_km')
    vehicle_type = request.data.get('vehicle_type', 'Sedan')
    pickup_time = request.data.get('pickup_time') # e.g. "23:30"
    passengers = int(request.data.get('passengers', 1))

    if distance_km is None:
        p_lat = request.data.get('pickup_lat')
        p_lng = request.data.get('pickup_lng')
        d_lat = request.data.get('drop_lat')
        d_lng = request.data.get('drop_lng')
        if p_lat is not None and p_lng is not None and d_lat is not None and d_lng is not None:
            import math
            try:
                lat1, lon1 = math.radians(float(p_lat)), math.radians(float(p_lng))
                lat2, lon2 = math.radians(float(d_lat)), math.radians(float(d_lng))
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                # road distance is typically ~1.25x straight line
                calc_dist = round(c * 6371.0 * 1.25, 2)
                distance_km = max(calc_dist, 1.0)
            except Exception:
                return Response({'success': False, 'message': 'Invalid coordinates provided'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'success': False, 'message': 'distance_km or coordinates required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        dist = Decimal(str(distance_km))
    except Exception:
        return Response({'success': False, 'message': 'Invalid distance value'}, status=status.HTTP_400_BAD_REQUEST)

    # Fetch fare setting from DB
    fare_setting = FareSetting.objects.filter(vehicle_type__iexact=vehicle_type, is_active=True).first()
    if not fare_setting:
        # Fallback defaults if not seeded yet
        defaults = {
            'Mini': (Decimal('80.00'), Decimal('12.00')),
            'Sedan': (Decimal('100.00'), Decimal('15.00')),
            'SUV': (Decimal('120.00'), Decimal('20.00')),
            'Premium': (Decimal('150.00'), Decimal('25.00')),
        }
        b_fare, p_km = defaults.get(vehicle_type, (Decimal('100.00'), Decimal('15.00')))
        base_fare = b_fare
        price_per_km = p_km
        min_fare = Decimal('80.00')
        waiting_charge = Decimal('0.00')
        night_percent = Decimal('15.00')
        extra_pass_charge = Decimal('20.00')
    else:
        base_fare = fare_setting.base_fare
        price_per_km = fare_setting.price_per_km
        min_fare = fare_setting.min_fare
        waiting_charge = Decimal('0.00') # default initial waiting
        night_percent = fare_setting.night_charge_percent
        extra_pass_charge = fare_setting.additional_passenger_charge

    distance_fare = dist * price_per_km

    # Night charge calculation (10 PM to 6 AM)
    night_charge = Decimal('0.00')
    is_night_ride = False
    if pickup_time:
        try:
            pt = datetime.strptime(pickup_time, '%H:%M').time()
            if pt.hour >= 22 or pt.hour < 6:
                is_night_ride = True
                night_charge = (base_fare + distance_fare) * (night_percent / Decimal('100.00'))
        except Exception:
            pass

    # Additional passenger charge if > standard capacity (4 for mini/sedan/premium, 6 for suv)
    std_cap = 6 if vehicle_type.lower() == 'suv' else 4
    additional_passenger_charge = Decimal('0.00')
    if passengers > std_cap:
        additional_passenger_charge = Decimal(str(passengers - std_cap)) * extra_pass_charge

    # Total Calculation
    total_fare = base_fare + distance_fare + waiting_charge + night_charge + additional_passenger_charge
    if total_fare < min_fare:
        total_fare = min_fare

    return Response({
        'success': True,
        'estimate': {
            'vehicle_type': vehicle_type,
            'distance_km': float(dist),
            'base_fare': float(base_fare),
            'price_per_km': float(price_per_km),
            'distance_fare': round(float(distance_fare), 2),
            'waiting_charge': round(float(waiting_charge), 2),
            'night_charge': round(float(night_charge), 2),
            'is_night_ride': is_night_ride,
            'additional_passenger_charge': round(float(additional_passenger_charge), 2),
            'total_fare': round(float(total_fare), 2),
        }
    })
