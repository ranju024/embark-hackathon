from datetime import date, datetime, time, timedelta

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from compliance.models import ComplianceCheck
from households.models import Household
from rewards.models import GreenPointsEntry
from .models import BulkPickupRequest, HouseholdServicePreference, HouseholdSubscription
from .serializers import BulkPickupRequestSerializer
from .services import (
    bulk_credit_periods,
    get_active_subscription,
    has_plan_feature,
    households_with_feature,
)

MAX_BULK_DAYS_AHEAD = 60
WINDOW_ORDER = {"morning": 0, "midday": 1, "afternoon": 2}
FEATURE_NAMES = ["assisted_segregation", "priority_pickup", "compost_addon", "monthly_compliance_report"]


def _bad(detail, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": detail}, status=code)


def _ward_filter(request):
    """Returns (ward_int_or_None, error_response_or_None)."""
    ward = request.query_params.get("ward")
    if not ward:
        return None, None
    try:
        return int(ward), None
    except ValueError:
        return None, _bad("ward must be a number.")


def feature_flags(household):
    flags = {name: has_plan_feature(household, name) for name in FEATURE_NAMES}
    flags["bulk_credits_remaining"] = sum(p["remaining"] for p in bulk_credit_periods(household))
    return flags


# ---------------------------------------------------------------- preferences

@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def service_preferences(request):
    household = getattr(request.user, "household", None)
    if household is None:
        return _bad("Register a household first.")

    pref, _ = HouseholdServicePreference.objects.get_or_create(household=household)
    flags = feature_flags(household)

    if request.method == "PUT":
        window = request.data.get("priority_window", pref.priority_window)
        compost = request.data.get("compost_pickup", pref.compost_pickup)

        if window not in {choice[0] for choice in HouseholdServicePreference.WINDOW_CHOICES}:
            return _bad("Invalid pickup window.")
        if not isinstance(compost, bool):
            return _bad("compost_pickup must be true or false.")

        # Only a CHANGE needs the feature — clearing a perk after a plan lapses is always allowed.
        if window and window != pref.priority_window and not flags["priority_pickup"]:
            return _bad("Priority pickup isn't part of your current plan.", status.HTTP_403_FORBIDDEN)
        if compost and not pref.compost_pickup and not flags["compost_addon"]:
            return _bad("The compost add-on isn't part of your current plan.", status.HTTP_403_FORBIDDEN)

        pref.priority_window = window
        pref.compost_pickup = compost
        pref.save()

    return Response({
        "priority_window": pref.priority_window,
        "compost_pickup": pref.compost_pickup,
        "features": flags,
    })


# ---------------------------------------------------------------- bulk pickups

class BulkPickupViewSet(viewsets.ViewSet):
    """
    Residents: list/create/cancel their own. Staff: list upcoming scheduled
    requests (optionally ?ward=), mark complete, or cancel any.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        if request.user.is_staff:
            ward, error = _ward_filter(request)
            if error:
                return error
            qs = BulkPickupRequest.objects.select_related("household").filter(
                status="scheduled", pickup_date__gte=timezone.localdate()
            )
            if ward is not None:
                qs = qs.filter(household__ward_number=ward)
        else:
            household = getattr(request.user, "household", None)
            if household is None:
                return Response([])
            qs = BulkPickupRequest.objects.select_related("household").filter(
                household=household
            ).order_by("-pickup_date")
        return Response(BulkPickupRequestSerializer(qs, many=True).data)

    def create(self, request):
        household = getattr(request.user, "household", None)
        if household is None:
            return _bad("Register a household first.")

        description = (request.data.get("description") or "").strip()
        if not description:
            return _bad("Describe what needs to be collected.")
        if len(description) > 300:
            return _bad("Description is too long (300 characters max).")

        try:
            pickup_date = date.fromisoformat(str(request.data.get("pickup_date")))
        except ValueError:
            return _bad("Choose a valid pickup date.")

        today = timezone.localdate()
        if pickup_date <= today:
            return _bad("Choose a date from tomorrow onwards.")
        if pickup_date > today + timedelta(days=MAX_BULK_DAYS_AHEAD):
            return _bad(f"Bulk pickups can be booked up to {MAX_BULK_DAYS_AHEAD} days ahead.")

        with transaction.atomic():
            # Lock the candidate subscription rows so two simultaneous
            # requests can't both spend the last credit.
            candidates = list(
                HouseholdSubscription.objects.select_for_update(of=("self",))
                .select_related("plan")
                .filter(
                    household=household,
                    status__in=["active", "superseded"],
                    period_start__lte=pickup_date,
                    period_end__gte=pickup_date,
                    plan__bulk_pickup_credits_per_month__gt=0,
                )
                .order_by("period_start")
            )
            if not candidates:
                return _bad("No paid plan with bulk pickup credits covers that date.")

            subscription = next(
                (s for s in candidates if s.bulk_pickup_credits_used < s.plan.bulk_pickup_credits_per_month),
                None,
            )
            if subscription is None:
                return _bad("You've used all bulk pickup credits for that period. Credits reset when your plan renews.")

            if BulkPickupRequest.objects.filter(
                household=household, pickup_date=pickup_date, status="scheduled"
            ).exists():
                return _bad("You already have a bulk pickup scheduled for that day.")

            pickup = BulkPickupRequest.objects.create(
                household=household,
                subscription=subscription,
                pickup_date=pickup_date,
                description=description,
            )
            subscription.bulk_pickup_credits_used += 1
            subscription.save(update_fields=["bulk_pickup_credits_used", "updated_at"])

        return Response(BulkPickupRequestSerializer(pickup).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            pickup = get_object_or_404(
                BulkPickupRequest.objects.select_for_update(of=("self",)).select_related("household"), pk=pk
            )
            is_owner = pickup.household.owner_id == request.user.id
            if not (is_owner or request.user.is_staff):
                return _bad("Pickup not found.", status.HTTP_404_NOT_FOUND)
            if pickup.status != "scheduled":
                return _bad(f"This pickup is already {pickup.status}.")
            if not request.user.is_staff and pickup.pickup_date <= timezone.localdate():
                return _bad("It's too late to cancel — residents can cancel up to the day before.")

            pickup.status = "cancelled"
            pickup.save()

            subscription = HouseholdSubscription.objects.select_for_update().get(pk=pickup.subscription_id)
            if subscription.bulk_pickup_credits_used > 0:
                subscription.bulk_pickup_credits_used -= 1
                subscription.save(update_fields=["bulk_pickup_credits_used", "updated_at"])

        return Response(BulkPickupRequestSerializer(pickup).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def complete(self, request, pk=None):
        with transaction.atomic():
            pickup = get_object_or_404(BulkPickupRequest.objects.select_for_update(), pk=pk)
            if pickup.status != "scheduled":
                return _bad(f"This pickup is already {pickup.status}.")
            pickup.status = "completed"
            pickup.completed_at = timezone.now()
            pickup.save()
        return Response(BulkPickupRequestSerializer(pickup).data)


# ---------------------------------------------------------------- staff lists

def _household_row(household, **extra):
    return {
        "household_id": household.id,
        "ward_number": household.ward_number,
        "house_number": household.house_number,
        "owner_name": household.owner_name,
        **extra,
    }


@api_view(["GET"])
@permission_classes([IsAdminUser])
def service_lists(request):
    """Who needs special handling on collection days. Optional ?ward=5."""
    ward, error = _ward_filter(request)
    if error:
        return error

    def in_ward(qs, prefix=""):
        return qs.filter(**{f"{prefix}ward_number": ward}) if ward is not None else qs

    priority_prefs = in_ward(
        HouseholdServicePreference.objects.select_related("household").filter(
            household_id__in=households_with_feature("priority_pickup")
        ).exclude(priority_window=""),
        prefix="household__",
    )
    priority = sorted(
        (_household_row(p.household, priority_window=p.priority_window) for p in priority_prefs),
        key=lambda r: (r["ward_number"], WINDOW_ORDER.get(r["priority_window"], 9), r["house_number"]),
    )

    compost_prefs = in_ward(
        HouseholdServicePreference.objects.select_related("household").filter(
            household_id__in=households_with_feature("compost_addon"), compost_pickup=True
        ),
        prefix="household__",
    )
    compost = sorted(
        (_household_row(p.household) for p in compost_prefs),
        key=lambda r: (r["ward_number"], r["house_number"]),
    )

    assisted_households = in_ward(
        Household.objects.filter(id__in=households_with_feature("assisted_segregation"))
    ).order_by("ward_number", "house_number")
    assisted = [_household_row(h) for h in assisted_households]

    return Response({"priority": priority, "compost": compost, "assisted": assisted})


# ---------------------------------------------------------------- monthly report

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def monthly_report(request):
    household = getattr(request.user, "household", None)
    if household is None:
        return _bad("Register a household first.")
    if not has_plan_feature(household, "monthly_compliance_report"):
        return _bad("Monthly compliance reports aren't included in your current plan.", status.HTTP_403_FORBIDDEN)

    today = timezone.localdate()
    month_param = request.query_params.get("month") or today.strftime("%Y-%m")
    try:
        year, month = (int(part) for part in month_param.split("-"))
        first_day = date(year, month, 1)
    except (ValueError, TypeError):
        return _bad("month must look like 2026-11.")
    if first_day > today.replace(day=1):
        return _bad("That month hasn't happened yet.")

    next_month_first = (first_day.replace(day=28) + timedelta(days=4)).replace(day=1)
    start = timezone.make_aware(datetime.combine(first_day, time.min))
    end = timezone.make_aware(datetime.combine(next_month_first, time.min))

    checks = ComplianceCheck.objects.filter(
        household=household, checked_at__gte=start, checked_at__lt=end
    ).order_by("checked_at")

    totals = checks.aggregate(
        total=Count("id"),
        compliant=Count("id", filter=Q(status="compliant")),
        non_compliant=Count("id", filter=Q(status="non_compliant")),
        pending=Count("id", filter=Q(status="pending_review")),
        total_kg=Sum("weight_kg"),
        organic_kg=Sum("weight_kg", filter=Q(waste_type="organic")),
        dry_kg=Sum("weight_kg", filter=Q(waste_type="dry")),
        both_kg=Sum("weight_kg", filter=Q(waste_type="both")),
    )
    reviewed = totals["compliant"] + totals["non_compliant"]
    compliance_rate = round((totals["compliant"] / reviewed) * 100) if reviewed else None

    points = GreenPointsEntry.objects.filter(
        household=household, created_at__gte=start, created_at__lt=end
    ).aggregate(
        earned=Sum("points", filter=Q(points__gt=0)),
        lost=Sum("points", filter=Q(points__lt=0, compliance_check__isnull=False)),
        redeemed=Sum("points", filter=Q(redemption__isnull=False)),
        net=Sum("points"),
    )

    bulk_completed = BulkPickupRequest.objects.filter(
        household=household, status="completed", completed_at__gte=start, completed_at__lt=end
    ).count()

    subscription = get_active_subscription(household)

    def kg(value):
        return float(value or 0)

    return Response({
        "month": first_day.strftime("%Y-%m"),
        "month_label": first_day.strftime("%B %Y"),
        "generated_on": today.isoformat(),
        "household": {
            "owner_name": household.owner_name,
            "ward_number": household.ward_number,
            "house_number": household.house_number,
        },
        "plan": subscription.plan.name if subscription else None,
        "summary": {
            "total_checks": totals["total"],
            "compliant": totals["compliant"],
            "non_compliant": totals["non_compliant"],
            "pending_review": totals["pending"],
            "compliance_rate": compliance_rate,
            "total_kg": kg(totals["total_kg"]),
            "organic_kg": kg(totals["organic_kg"]),
            "dry_kg": kg(totals["dry_kg"]),
            "both_kg": kg(totals["both_kg"]),
            "bulk_pickups_completed": bulk_completed,
        },
        "points": {
            "earned": points["earned"] or 0,
            "lost": abs(points["lost"] or 0),
            "redeemed": abs(points["redeemed"] or 0),
            "net": points["net"] or 0,
        },
        "checks": [
            {
                "date": timezone.localtime(c.checked_at).date().isoformat(),
                "waste_type": c.get_waste_type_display(),
                "weight_kg": kg(c.weight_kg),
                "status": c.status,
                "notes": c.notes,
            }
            for c in checks
        ],
    })