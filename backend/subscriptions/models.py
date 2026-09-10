import uuid
from django.db import models
from django.utils import timezone
from datetime import timedelta
from households.models import Household


class SubscriptionPlan(models.Model):
    """
    Admin-editable catalog of paid plans. The free LMC basic collection
    is NOT a row here, a household with no active HouseholdSubscription
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
        self.status = "active"
        self.period_start = timezone.localdate()
        self.period_end = self.period_start + timedelta(days=30)
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