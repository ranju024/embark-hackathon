from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User
from django.db import models


class WardSchedule(models.Model):
    DAYS_OF_WEEK = [
        (0, "Monday"), (1, "Tuesday"), (2, "Wednesday"),
        (3, "Thursday"), (4, "Friday"), (5, "Saturday"), (6, "Sunday"),
    ]

    ward_number = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(29)], unique=True)
    pickup_day = models.SmallIntegerField(choices=DAYS_OF_WEEK)
    pickup_time = models.TimeField()

    def __str__(self):
        return f"Ward {self.ward_number} —> {self.get_pickup_day_display()} -> {self.pickup_time}"


class ScheduleNotice(models.Model):
    NOTICE_TYPES = [
        ("holiday", "Holiday — No Pickup"),
        ("delay", "Delayed Pickup"),
    ]

    ward_number = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(29)], null=True, blank=True)
    date = models.DateField()

    notice_type = models.CharField(max_length=10, choices=NOTICE_TYPES)
    delayed_to_time = models.TimeField(null=True, blank=True)
    reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.notice_type == "delay" and not self.delayed_to_time:
            raise ValidationError({"delayed_to_time": "This field is required when notice type is delay."})
        if self.notice_type == "holiday" and self.delayed_to_time:
            raise ValidationError({"delayed_to_time": "This field should not be set when notice type is holiday."})

    def __str__(self):
        scope = f"Ward {self.ward_number}" if self.ward_number else "All wards"
        return f"{scope} —> {self.notice_type} on {self.date}"


class CollectorRoute(models.Model):
    """
    Human-assigned record of which staff collector covers which ward on
    which day. current_lat/current_lng/last_location_update are updated
    by the collector's own browser (Geolocation API) ONLY while the route
    is in_progress — never a background/continuous tracker, and cleared
    the moment the route is completed or missed.
    """
    STATUS_CHOICES = [
        ("assigned", "Assigned"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("missed", "Missed"),
    ]

    ward_number = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(29)])
    collector = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="collector_routes",
        limit_choices_to={"is_staff": True},
    )
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="assigned")
    notes = models.CharField(max_length=300, blank=True)

    current_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    current_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_location_update = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("ward_number", "date")

    def __str__(self):
        return f"Ward {self.ward_number} — {self.collector.username} on {self.date} ({self.status})"