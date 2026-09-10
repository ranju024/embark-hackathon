import secrets
from django.db import models
from django.db.models import Q
from django.utils import timezone
from households.models import Household
from compliance.models import ComplianceCheck

POINTS_FOR_COMPLIANT = 10
POINTS_FOR_NON_COMPLIANT = -15


def generate_voucher_code():
    return f"WW-{secrets.token_hex(4).upper()}"


class PartnerOffer(models.Model):
    """
    Admin-editable catalog of what GreenPoints can be redeemed for.
    Static/example partner data for now — no real API integration,
    just a name + description + point cost.
    """
    partner_name = models.CharField(max_length=100)
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    points_cost = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.partner_name} — {self.title} ({self.points_cost} pts)"


class Redemption(models.Model):
    """
    One row per redemption. points_spent is a snapshot of the offer's
    cost at redemption time, so later admin price changes don't rewrite
    history. voucher_code is what the household shows the partner.
    """
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="redemptions")
    offer = models.ForeignKey(PartnerOffer, on_delete=models.PROTECT, related_name="redemptions")
    points_spent = models.PositiveIntegerField()
    voucher_code = models.CharField(max_length=20, unique=True, editable=False, default=generate_voucher_code)
    is_used = models.BooleanField(default=False)

    redeemed_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    def mark_used(self):
        self.is_used = True
        self.used_at = timezone.now()
        self.save()

    def __str__(self):
        return f"{self.household} -> {self.offer.title} ({self.voucher_code})"


class GreenPointsEntry(models.Model):
    """
    One point transaction. Traces back to EXACTLY ONE source:
    a ComplianceCheck (positive/negative, from the signal) or a
    Redemption (always negative, from the redeem view). Never both,
    never neither — enforced by the CheckConstraint below.
    """
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="points_entries")
    compliance_check = models.OneToOneField(ComplianceCheck, on_delete=models.CASCADE, null=True, blank=True)
    redemption = models.OneToOneField(Redemption, on_delete=models.CASCADE, null=True, blank=True, related_name="points_entry")
    points = models.IntegerField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(compliance_check__isnull=False, redemption__isnull=True) |
                    Q(compliance_check__isnull=True, redemption__isnull=False)
                ),
                name="points_entry_exactly_one_source",
            )
        ]

    def __str__(self):
        return f"{self.household} —> {self.points:+d} points"