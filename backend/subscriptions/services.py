"""
Subscription state helpers. Expiry is lazy: instead of a background job,
every lookup first flips overdue 'active' rows to 'expired', so the
database never reports a lapsed plan as active for long.
"""
from django.utils import timezone
from .models import HouseholdSubscription

RENEWAL_WINDOW_DAYS = 7

# Rows that represent days the household genuinely paid for.
PAID_STATUSES = ["active", "superseded", "expired"]

PLAN_FEATURES = {
    "assisted_segregation",
    "priority_pickup",
    "compost_addon",
    "monthly_compliance_report",
}


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


def has_plan_feature(household, feature, on_date=None):
    """
    True if a paid period with `feature` covered `on_date` (default today).
    Uses the period dates themselves, so it stays correct for past dates
    (e.g. scoring a check that was reviewed days after it happened).
    """
    if feature not in PLAN_FEATURES:
        raise ValueError(f"Unknown plan feature: {feature}")
    day = on_date or timezone.localdate()
    return HouseholdSubscription.objects.filter(
        household=household,
        status__in=PAID_STATUSES,
        period_start__lte=day,
        period_end__gte=day,
        **{f"plan__{feature}": True},
    ).exists()


def households_with_feature(feature):
    """Subquery of household ids covered today by a paid plan with `feature`."""
    if feature not in PLAN_FEATURES:
        raise ValueError(f"Unknown plan feature: {feature}")
    today = timezone.localdate()
    return HouseholdSubscription.objects.filter(
        status__in=PAID_STATUSES,
        period_start__lte=today,
        period_end__gte=today,
        **{f"plan__{feature}": True},
    ).values("household_id")


def bulk_credit_periods(household):
    """Unexpired paid periods that include bulk pickup credits, with credits left."""
    today = timezone.localdate()
    subs = (
        HouseholdSubscription.objects.select_related("plan")
        .filter(household=household, status__in=["active", "superseded"], period_end__gte=today)
        .order_by("period_start")
    )
    periods = []
    for sub in subs:
        total = sub.plan.bulk_pickup_credits_per_month
        if total <= 0:
            continue
        periods.append({
            "subscription_id": sub.id,
            "period_start": sub.period_start,
            "period_end": sub.period_end,
            "total": total,
            "remaining": max(0, total - sub.bulk_pickup_credits_used),
        })
    return periods