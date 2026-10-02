from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Payment
from .serializers import PaymentSerializer

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
