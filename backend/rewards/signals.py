from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from compliance.models import ComplianceCheck
from subscriptions.services import has_plan_feature
from .models import GreenPointsEntry, POINTS_FOR_COMPLIANT, POINTS_FOR_NON_COMPLIANT

# Households on a plan with assisted segregation have the collector sort
# their waste, so a compliant check earns less and a failed one costs nothing.
POINTS_FOR_COMPLIANT_ASSISTED = 5
POINTS_FOR_NON_COMPLIANT_ASSISTED = 0


def points_for_check(check, status):
    """
    What a check is worth with the given verdict, judged by the plan the
    household had on the day of the check (not the day it was reviewed).
    Shared by the review signal below and by upheld appeals.
    """
    check_date = timezone.localtime(check.checked_at).date()
    assisted = has_plan_feature(check.household, "assisted_segregation", on_date=check_date)
    if status == "compliant":
        return POINTS_FOR_COMPLIANT_ASSISTED if assisted else POINTS_FOR_COMPLIANT
    return POINTS_FOR_NON_COMPLIANT_ASSISTED if assisted else POINTS_FOR_NON_COMPLIANT


@receiver(post_save, sender=ComplianceCheck)
def create_points_entry(sender, instance, created, **kwargs):
    """
    Fires on EVERY save of a ComplianceCheck. The initial creation
    (status="pending_review") should do nothing. Only the later review()
    update (status becomes "compliant"/"non_compliant") should award
    points exactly once.
    """
    if instance.status not in ("compliant", "non_compliant"):
        return

    if GreenPointsEntry.objects.filter(compliance_check=instance).exists():
        return

    GreenPointsEntry.objects.create(
        household=instance.household,
        compliance_check=instance,
        points=points_for_check(instance, instance.status),
    )