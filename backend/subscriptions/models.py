import uuid
from datetime import timedelta
from django.db import models
from django.db.models import Q
from django.utils import timezone
from households.models import Household

SUBSCRIPTION_PERIOD_DAYS = 30


class SubscriptionPlan(models.Model):
    """
    Admin-editable catalog of paid plans. The free LMC basic collection
    is NOT a row here — a household with no active HouseholdSubscription
    is simply on the free tier by default.
    """
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    monthly_price_npr = models.DecimalField(max_digits=8, decimal_places=2)

    assisted_segregation = models.BooleanField(default=False)
    priority_pickup = models.BooleanField(default=False)
    compost_addon = models.BooleanField(default=False)
    bulk_pickup_credits_per_month = models.PositiveIntegerField(default=0)
    monthly_compliance_report = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)  # admin can retire a plan without deleting history

    def __str__(self):
        return f"{self.name} (Rs. {self.monthly_price_npr}/mo)"


class HouseholdSubscription(models.Model):
    """
    One row per billing period, so plan changes/renewals stay as
    history rather than overwriting a single mutable row.
    """
    STATUS_CHOICES = [
        ("pending_payment", "Pending Payment"),
        ("active", "Active"),
        ("expired", "Expired"),
        ("superseded", "Superseded by renewal"),
        ("cancelled", "Cancelled"),
        ("payment_failed", "Payment Failed"),
    ]

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="subscriptions")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending_payment")

    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)

    bulk_pickup_credits_used = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def activate(self):
        """
        Starts a paid period. If the household still has paid days left on
        another active subscription (a renewal inside the renewal window),
        the new period begins where that one ends so no paid days are
        lost, and the older row is marked superseded.
        """
        today = timezone.localdate()
        others = HouseholdSubscription.objects.filter(
            household=self.household, status="active"
        ).exclude(pk=self.pk)

        start = today
        latest_end = others.filter(period_end__gte=today).order_by("-period_end").values_list("period_end", flat=True).first()
        if latest_end:
            start = latest_end

        others.update(status="superseded")

        self.status = "active"
        self.period_start = start
        self.period_end = start + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
        self.save()

    def __str__(self):
        return f"{self.household} -> {self.plan.name} ({self.status})"


class Payment(models.Model):
    """One row per eSewa payment attempt, success or not — full audit trail."""
    STATUS_CHOICES = [
        ("initiated", "Initiated"),
        ("complete", "Complete"),
        ("failed", "Failed"),
    ]

    subscription = models.ForeignKey(HouseholdSubscription, on_delete=models.CASCADE, related_name="payments")
    transaction_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="initiated")
    esewa_ref_id = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Payment {self.transaction_uuid} — {self.status}"


class HouseholdServicePreference(models.Model):
    """
    A household's choices for plan perks. Stored even if the plan later
    lapses, but staff-facing lists only honour them while a paid plan
    with the matching feature covers today.
    """
    WINDOW_CHOICES = [
        ("", "No preference"),
        ("morning", "Morning (6-10 AM)"),
        ("midday", "Midday (10 AM-2 PM)"),
        ("afternoon", "Afternoon (2-6 PM)"),
    ]

    household = models.OneToOneField(Household, on_delete=models.CASCADE, related_name="service_preference")
    priority_window = models.CharField(max_length=10, choices=WINDOW_CHOICES, blank=True, default="")
    compost_pickup = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferences for {self.household}"


class BulkPickupRequest(models.Model):
    """
    A one-off large-waste pickup, paid for with one plan credit. The
    subscription row records WHICH period's credit was used so a
    cancellation refunds the right one.
    """
    STATUS_CHOICES = [
        ("scheduled", "Scheduled"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="bulk_pickups")
    subscription = models.ForeignKey(HouseholdSubscription, on_delete=models.CASCADE, related_name="bulk_pickups")
    pickup_date = models.DateField()
    description = models.CharField(max_length=300)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="scheduled")

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["pickup_date", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "pickup_date"],
                condition=Q(status="scheduled"),
                name="one_scheduled_bulk_pickup_per_household_day",
            )
        ]

    def __str__(self):
        return f"{self.household} — bulk pickup {self.pickup_date} ({self.status})"