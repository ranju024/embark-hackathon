from datetime import timedelta
from django.utils import timezone
from compliance.models import ComplianceCheck
from rewards.models import GreenPointsEntry
from rewards.signals import points_for_check

APPEAL_WINDOW_DAYS = 7
MAX_OPEN_COMPLAINTS = 5


def get_review_entry(check):
    """The points entry created when an officer reviewed this check (None if still pending)."""
    return GreenPointsEntry.objects.filter(compliance_check=check).first()


def appeal_deadline(entry):
    """The window is measured from the day the officer reviewed the check."""
    return entry.created_at + timedelta(days=APPEAL_WINDOW_DAYS)


def appealable_checks(household):
    """Non-compliant results still inside the window and not already appealed."""
    cutoff = timezone.now() - timedelta(days=APPEAL_WINDOW_DAYS)
    return (
        ComplianceCheck.objects.select_related("greenpointsentry")
        .filter(
            household=household,
            status="non_compliant",
            greenpointsentry__created_at__gte=cutoff,
            complaints__isnull=True,
        )
        .order_by("-checked_at")
    )


def overturn_check(check):
    """
    An upheld appeal: the check becomes compliant and its points entry is
    corrected to what a compliant check was worth. Call inside transaction.atomic().
    """
    check = (
        ComplianceCheck.objects.select_for_update(of=("self",))
        .select_related("household")
        .get(pk=check.pk)
    )
    if check.status == "compliant":
        return

    check.status = "compliant"
    check.save(update_fields=["status"])  # the points signal sees the entry exists and does nothing

    new_points = points_for_check(check, "compliant")
    entry, created = GreenPointsEntry.objects.select_for_update().get_or_create(
        compliance_check=check,
        defaults={"household": check.household, "points": new_points},
    )
    if not created and entry.points != new_points:
        entry.points = new_points
        entry.save(update_fields=["points"])