from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
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

    CATEGORY_CHOICES = [
        ("missed_pickup", "Missed pickup"),
        ("bin_or_bag_issue", "Bin or bag issue"),
        ("collector_conduct", "Collector conduct"),
        ("illegal_dumping", "Illegal dumping"),
        ("appeal", "Appeal of a compliance result"),
        ("other", "Other"),
    ]

    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="complaints"
    )

    # An appeal is tied to a specific check; a general complaint isn't.
    compliance_check = models.ForeignKey(
        ComplianceCheck, on_delete=models.PROTECT,
        null=True, blank=True, related_name="complaints"
    )

    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="other")
    description = models.TextField()
    photo = models.ImageField(upload_to="complaint_photos/%Y/%m/", null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    resolution_notes = models.CharField(max_length=300, blank=True)
    handled_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="handled_complaints"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # Backstop for the serializer check: two simultaneous requests
            # can't both create an appeal for the same result.
            models.UniqueConstraint(
                fields=["compliance_check"],
                condition=Q(compliance_check__isnull=False),
                name="one_appeal_per_compliance_check",
            )
        ]

    def __str__(self):
        return f"{self.household} — {self.status} ({self.created_at.date()})"