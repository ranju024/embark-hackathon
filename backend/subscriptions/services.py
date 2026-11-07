"""
Subscription state helpers. Expiry is lazy: instead of a background job,
every lookup first flips overdue 'active' rows to 'expired', so the
database never reports a lapsed plan as active for long.
"""
from django.utils import timezone
from .models import HouseholdSubscription

RENEWAL_WINDOW_DAYS = 7


def expire_stale_subscriptions(household):
    HouseholdSubscription.objects.filter(
        household=household, status="active", period_end__lt=timezone.localdate()
    ).update(status="expired")


def get_active_subscription(household):
    """The household's currently paid-up subscription, or None (free tier)."""
    expire_stale_subscriptions(household)
    return (
        HouseholdSubscription.objects.select_related("plan")
        .filter(household=household, status="active")
        .order_by("-period_end")
        .first()
    )


def get_days_remaining(subscription):
    if subscription.status != "active" or not subscription.period_end:
        return None
    return (subscription.period_end - timezone.localdate()).days


def can_renew(subscription):
    days = get_days_remaining(subscription)
    return days is not None and days <= RENEWAL_WINDOW_DAYS