from django.db import models
from households.models import Household
from compliance.models import ComplianceCheck

POINTS_FOR_COMPLIANT = 10
POINTS_FOR_NON_COMPLIANT = -15


class GreenPointsEntry(models.Model):
    """
    One point transaction, always traceable back to the ComplianceCheck
    that caused it. Never created manually by a client, only by the
    signal in signals.py.
    """
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="points_entries")
    compliance_check = models.OneToOneField(ComplianceCheck, on_delete=models.CASCADE)
    points = models.IntegerField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.household} —> {self.points:+d} points"