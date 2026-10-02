from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Review
from .serializers import ReviewSerializer
from bookings.models import Booking

@api_view(['GET', 'POST'])
def review_list_create_view(request):
    if request.method == 'GET':
        driver_id = request.query_params.get('driver_id')
        reviews = Review.objects.select_related('customer', 'driver', 'booking').all()
        if driver_id:
            reviews = reviews.filter(driver_id=driver_id)
        
        serializer = ReviewSerializer(reviews, many=True)
        return Response({'success': True, 'reviews': serializer.data})

    # POST Review
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required to review a trip'}, status=status.HTTP_401_UNAUTHORIZED)

    booking_id = request.data.get('booking_id')
    if not booking_id:
        return Response({'success': False, 'message': 'booking_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        if str(booking_id).isdigit():
            booking = Booking.objects.select_related('driver').get(pk=booking_id)
        else:
            booking = Booking.objects.select_related('driver').get(booking_id__iexact=str(booking_id))
    except Booking.DoesNotExist:
        return Response({'success': False, 'message': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

    if booking.customer != request.user and not request.user.is_staff:
        return Response({'success': False, 'message': 'You can only review your own rides'}, status=status.HTTP_403_FORBIDDEN)

    if booking.status != 'trip_completed':
        return Response({'success': False, 'message': 'You can only review trips that are completed'}, status=status.HTTP_400_BAD_REQUEST)

    if hasattr(booking, 'review'):
        return Response({'success': False, 'message': 'A review has already been submitted for this booking'}, status=status.HTTP_400_BAD_REQUEST)

    if not booking.driver:
        return Response({'success': False, 'message': 'No driver was assigned to this booking'}, status=status.HTTP_400_BAD_REQUEST)

    rating = request.data.get('rating')
    comment = request.data.get('comment', '')

    try:
        rating_int = int(rating)
        if not (1 <= rating_int <= 5):
            raise ValueError()
    except Exception:
        return Response({'success': False, 'message': 'Rating must be an integer between 1 and 5'}, status=status.HTTP_400_BAD_REQUEST)

    review = Review.objects.create(
        booking=booking,
        customer=request.user,
        driver=booking.driver,
        rating=rating_int,
        comment=comment
    )

    return Response({
        'success': True,
        'message': 'Thank you! Your review and rating have been recorded.',
        'review': ReviewSerializer(review).data
    }, status=status.HTTP_201_CREATED)
