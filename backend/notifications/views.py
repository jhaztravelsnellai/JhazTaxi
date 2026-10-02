from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer

@api_view(['GET'])
def notification_list_view(request):
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:50]
    serializer = NotificationSerializer(notifications, many=True)
    unread_count = notifications.filter(is_read=False).count()
    return Response({
        'success': True,
        'unread_count': unread_count,
        'notifications': serializer.data
    })


@api_view(['POST'])
def notification_mark_read_view(request):
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    notification_id = request.data.get('notification_id')
    if notification_id:
        Notification.objects.filter(id=notification_id, user=request.user).update(is_read=True)
    else:
        # Mark all as read
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)

    return Response({'success': True, 'message': 'Notifications marked as read'})
