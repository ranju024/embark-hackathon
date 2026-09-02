from django.db import models
from households.models import Household
from compliance.models import ComplianceCheck


class Complaint(models.Model):
    """
    A citizen's complaint or appeal — either general ("my pickup was
    missed") or a formal appeal against a specific ComplianceCheck
    ("I was marked non-compliant but I did segregate correctly").
    """

    STATUS_CHOICES = [
        ("open", "Open"),
        ("under_review", "Under Review"),
        ("resolved", "Resolved"),
        ("rejected", "Rejected"),
    ]

    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="complaints"
    )

    # An appeal is tied to a specific check; a general complaint isn't.
    compliance_check = models.ForeignKey(
        ComplianceCheck, on_delete=models.PROTECT,
        null=True, blank=True, related_name="complaints"
    )

    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    resolution_notes = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateField(auto_now=True)

    def __str__(self):
        return f"{self.household} — {self.status} ({self.created_at.date()})"