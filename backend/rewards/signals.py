from django.db.models.signals import post_save
from django.dispatch import receiver
from compliance.models import ComplianceCheck
from .models import GreenPointsEntry, POINTS_FOR_COMPLIANT, POINTS_FOR_NON_COMPLIANT


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
    
    points = POINTS_FOR_COMPLIANT if instance.status == "compliant" else POINTS_FOR_NON_COMPLIANT
    GreenPointsEntry.objects.create(
        household=instance.household,
        compliance_check=instance,
        points=points,
    )