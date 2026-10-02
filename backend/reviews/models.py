from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from bookings.models import Booking
from drivers.models import Driver

class Review(models.Model):
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name='review'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews_given'
    )
    driver = models.ForeignKey(
        Driver,
        on_delete=models.CASCADE,
        related_name='reviews_received'
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Rating from 1 to 5 stars"
    )
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Automatically update driver's aggregated rating
        if self.driver:
            driver_reviews = Review.objects.filter(driver=self.driver)
            count = driver_reviews.count()
            avg = driver_reviews.aggregate(models.Avg('rating'))['rating__avg'] or 5.0
            self.driver.rating = round(avg, 2)
            self.driver.total_ratings_count = count
            self.driver.save(update_fields=['rating', 'total_ratings_count'])

    def __str__(self):
        return f"{self.rating} Stars Review for {self.driver.name} by {self.customer.get_full_name() or self.customer.username}"
