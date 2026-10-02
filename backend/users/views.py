from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.db.models import Count, Q
from .models import User
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer, DriverRegisterSerializer
from drivers.serializers import DriverSerializer

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'success': True,
            'message': 'Account created successfully!',
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response({
        'success': False,
        'message': 'Registration validation failed',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'success': True,
            'message': 'Login successful',
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
    return Response({
        'success': False,
        'message': 'Invalid credentials',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def admin_login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        # Strict backend authorization: must be admin or staff or superuser
        if user.role != 'admin' and not user.is_staff and not user.is_superuser:
            return Response({
                'success': False,
                'message': 'Access denied. You do not have administrator permissions.'
            }, status=status.HTTP_403_FORBIDDEN)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'success': True,
            'message': 'Admin authenticated successfully',
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
    return Response({
        'success': False,
        'message': 'Invalid credentials',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def driver_register_view(request):
    serializer = DriverRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user, driver = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'success': True,
            'message': 'Driver registered successfully! Welcome to JhazTaxi.',
            'token': token.key,
            'user': UserSerializer(user).data,
            'driver': DriverSerializer(driver, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)
    return Response({
        'success': False,
        'message': 'Driver registration failed',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def driver_login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        if user.role != 'driver' and not user.is_staff and user.role != 'admin':
            return Response({
                'success': False,
                'message': 'This is the Driver Portal. Please log in using the Customer Login page.'
            }, status=status.HTTP_403_FORBIDDEN)

        token, _ = Token.objects.get_or_create(user=user)
        from drivers.models import Driver
        driver = Driver.objects.filter(user=user).first()
        driver_data = DriverSerializer(driver, context={'request': request}).data if driver else None

        return Response({
            'success': True,
            'message': 'Driver authenticated successfully',
            'token': token.key,
            'user': UserSerializer(user).data,
            'driver': driver_data
        }, status=status.HTTP_200_OK)
    return Response({
        'success': False,
        'message': 'Invalid credentials',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def logout_view(request):
    if request.user.is_authenticated:
        Token.objects.filter(user=request.user).delete()
    return Response({'success': True, 'message': 'Logged out successfully'})


@api_view(['GET', 'PUT', 'PATCH'])
def profile_view(request):
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    user = request.user
    if request.method == 'GET':
        return Response({'success': True, 'user': UserSerializer(user).data})
    
    # Update profile
    full_name = request.data.get('full_name')
    if full_name:
        parts = full_name.strip().split(' ', 1)
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ''
    
    if 'phone_number' in request.data:
        user.phone_number = request.data['phone_number']
    if 'address' in request.data:
        user.address = request.data['address']
    
    user.save()
    return Response({
        'success': True,
        'message': 'Profile updated successfully',
        'user': UserSerializer(user).data
    })


@api_view(['GET'])
def admin_customers_list_view(request):
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    customers = User.objects.filter(role='customer').annotate(
        total_bookings=Count('bookings'),
        completed_trips=Count('bookings', filter=Q(bookings__status='trip_completed')),
        cancelled_trips=Count('bookings', filter=Q(bookings__status='cancelled'))
    ).order_by('-created_at')

    data = []
    for c in customers:
        data.append({
            'id': c.id,
            'name': c.get_full_name() or c.username,
            'email': c.email,
            'phone': c.phone_number or 'N/A',
            'is_active': c.is_active,
            'date_joined': c.created_at.strftime('%Y-%m-%d %H:%M'),
            'total_bookings': c.total_bookings,
            'completed_trips': c.completed_trips,
            'cancelled_trips': c.cancelled_trips
        })

    return Response({'success': True, 'customers': data})


@api_view(['PATCH'])
def admin_customer_toggle_status_view(request, customer_id):
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin permission required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        customer = User.objects.get(id=customer_id, role='customer')
        customer.is_active = not customer.is_active
        customer.save()
        return Response({
            'success': True,
            'message': f"Customer account has been {'activated' if customer.is_active else 'disabled'}.",
            'is_active': customer.is_active
        })
    except User.DoesNotExist:
        return Response({'success': False, 'message': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)
