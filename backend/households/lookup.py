from django.db.models import Count, Q

from complaints.models import Complaint
from compliance.models import ComplianceCheck
from rewards.services import get_badge_info
from subscriptions.models import HouseholdServicePreference
from subscriptions.services import get_active_subscription, has_plan_feature


def build_household_overview(household):
    """Everything a collector or officer wants to know about one house, in one payload."""
    checks = ComplianceCheck.objects.filter(household=household)
    counts = checks.aggregate(
        total=Count("id"),
        compliant=Count("id", filter=Q(status="compliant")),
        non_compliant=Count("id", filter=Q(status="non_compliant")),
        pending=Count("id", filter=Q(status="pending_review")),
    )
    reviewed = counts["compliant"] + counts["non_compliant"]

    recent = [
        {
            "id": c.id,
            "checked_at": c.checked_at,
            "waste_type": c.waste_type,
            "waste_type_display": c.get_waste_type_display(),
            "weight_kg": float(c.weight_kg),
            "status": c.status,
        }
        for c in checks.order_by("-checked_at")[:5]
    ]

    preference = HouseholdServicePreference.objects.filter(household=household).first()
    has_priority = has_plan_feature(household, "priority_pickup")
    has_compost = has_plan_feature(household, "compost_addon")
    subscription = get_active_subscription(household)
    badge = get_badge_info(household)

    return {
        "id": household.id,
        "ward_number": household.ward_number,
        "house_number": household.house_number,
        "owner_name": household.owner_name,
        "phone_number": str(household.phone_number),
        "plan": subscription.plan.name if subscription else None,
        "perks": {
            "assisted_segregation": has_plan_feature(household, "assisted_segregation"),
            "priority_window": preference.priority_window if has_priority and preference else "",
            "compost_pickup": bool(has_compost and preference and preference.compost_pickup),
        },
        "points": badge["total_points"],
        "tier": badge["tier"],
        "compliance": {
            "total": counts["total"],
            "compliant": counts["compliant"],
            "non_compliant": counts["non_compliant"],
            "pending": counts["pending"],
            "rate": round(counts["compliant"] / reviewed * 100) if reviewed else None,
        },
        "open_complaints": Complaint.objects.filter(
            household=household, status__in=["open", "under_review"]
        ).count(),
        "recent_checks": recent,
    }