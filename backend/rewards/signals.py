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

    # Judge by the day the check happened, not the day an officer reviewed it.
    check_date = timezone.localtime(instance.checked_at).date()
    assisted = has_plan_feature(instance.household, "assisted_segregation", on_date=check_date)

    if instance.status == "compliant":
        points = POINTS_FOR_COMPLIANT_ASSISTED if assisted else POINTS_FOR_COMPLIANT
    else:
        points = POINTS_FOR_NON_COMPLIANT_ASSISTED if assisted else POINTS_FOR_NON_COMPLIANT

    GreenPointsEntry.objects.create(
        household=instance.household,
        compliance_check=instance,
        points=points,
    )