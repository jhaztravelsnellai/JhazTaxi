from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from .models import Payment, PaymentSetting
from .serializers import PaymentSerializer, PaymentSettingSerializer

@api_view(['GET', 'POST'])
def payment_list_create_view(request):
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if request.method == 'GET':
        if request.user.role == 'customer' and not request.user.is_staff:
            payments = Payment.objects.filter(booking__customer=request.user).select_related('booking', 'booking__customer')
        else:
            payments = Payment.objects.all().select_related('booking', 'booking__customer')

        serializer = PaymentSerializer(payments, many=True)
        return Response({'success': True, 'payments': serializer.data})

    # POST - Record/update payment
    serializer = PaymentSerializer(data=request.data)
    if serializer.is_valid():
        payment = serializer.save()
        return Response({'success': True, 'message': 'Payment recorded', 'payment': PaymentSerializer(payment).data}, status=status.HTTP_201_CREATED)
    return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST', 'PATCH', 'PUT'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def payment_setting_view(request):
    """
    GET: Retrieve official GPay/UPI scanner & business payment info (Available for Booking & Drivers).
    POST / PUT / PATCH: Admin only. Upload custom GPay scanner image, update UPI ID, name, instructions.
    """
    setting = PaymentSetting.objects.first()
    if not setting:
        setting = PaymentSetting.objects.create(
            title="Official GPay / UPI Scanner",
            upi_id="jhaztaxi@upi",
            payee_name="JhazTaxi Travels",
            phone_number="+91 98765 43210",
            instructions="Scan using Google Pay, PhonePe, Paytm, or BHIM. Show payment screen to driver upon trip completion."
        )

    if request.method == 'GET':
        serializer = PaymentSettingSerializer(setting, context={'request': request})
        return Response({'success': True, 'setting': serializer.data})

    # Admin authentication check for modifications
    if not request.user.is_authenticated or (request.user.role != 'admin' and not request.user.is_staff):
        return Response({'success': False, 'message': 'Admin privileges required to update GPay scanner settings.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = PaymentSettingSerializer(setting, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        updated = serializer.save()
        return Response({
            'success': True,
            'message': 'GPay scanner & payment settings updated successfully.',
            'setting': PaymentSettingSerializer(updated, context={'request': request}).data
        })
    return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
