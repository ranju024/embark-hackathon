from django.db.models.signals import post_save
from django.dispatch import receiver
from compliance.models import ComplianceCheck
from .models import GreenPointsEntry, POINTS_FOR_COMPLIANT, POINTS_FOR_NON_COMPLIANT


@receiver(post_save, sender=ComplianceCheck) # when ComplianceCheck model is saved, this is triggered
def create_points_entry(sender, instance, created, **kwargs):
    """
    Runs automatically every time a ComplianceCheck is saved.
    `instance` is the ComplianceCheck that was just saved.
    `created` is True only on the FIRST save (creation), False on updates.
    """
    if not created:
        return

    points = POINTS_FOR_COMPLIANT if instance.status == "compliant" else POINTS_FOR_NON_COMPLIANT

    GreenPointsEntry.objects.create(
        household=instance.household,
        compliance_check=instance,
        points=points,
    )