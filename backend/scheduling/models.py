from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.core.exceptions import ValidationError


class WardSchedule(models.Model):
    """
    The RECURRING weekly pickup rule for a ward.
    e.g. "Ward 5 -> every Tuesday -> 8:00 AM"
    """

    DAYS_OF_WEEK = [
        (0, "Monday"),
        (1, "Tuesday"),
        (2, "Wednesday"),
        (3, "Thursday"),
        (4, "Friday"),
        (5, "Saturday"),
        (6, "Sunday"),
    ]

    ward_number = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(29)], unique=True)
    pickup_day = models.SmallIntegerField(choices=DAYS_OF_WEEK)
    pickup_time = models.TimeField()

    def __str__(self):
        return f"Ward {self.ward_number} —> {self.get_pickup_day_display()} -> {self.pickup_time}"


class ScheduleNotice(models.Model):
    """
    A ONE-OFF exception to the recurring schedule for a specific date.
    e.g. "Ward 5's pickup on 2026-09-20 is cancelled (Dashain holiday)"
    or "delayed to 2:00 PM instead of the usual 8:00 AM"
    """

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