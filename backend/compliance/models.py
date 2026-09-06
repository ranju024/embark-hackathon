import uuid
from django.db import models
from households.models import Household


class ComplianceCheck(models.Model):
    """
    A single verification event: a collector scans a household's QR,
    takes a photo of the waste bag(s). The collector does NOT set the
    final verdict — it starts as "pending_review" until a ward officer
    confirms or overrides it via the `review` action.
    """

    STATUS_CHOICES = [
        ("pending_review", "Pending Review"),
        ("compliant", "Compliant"),
        ("non_compliant", "Non-Compliant"),
    ]

    household = models.ForeignKey(
        Household, on_delete=models.PROTECT, related_name="compliance_checks"
    )

    photo = models.ImageField(upload_to="compliance_photos/%Y/%m/")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending_review")
    notes = models.CharField(max_length=300, blank=True)
    
    checked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.household} —> {self.status} on {self.checked_at.date()}"