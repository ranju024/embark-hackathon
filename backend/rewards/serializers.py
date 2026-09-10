from rest_framework import serializers
from django.db.models import Sum
from .models import GreenPointsEntry, PartnerOffer, Redemption
from households.models import Household


class GreenPointsEntrySerializer(serializers.ModelSerializer):
    household_display = serializers.CharField(source="household", read_only=True)

    class Meta:
        model = GreenPointsEntry
        fields = ["id", "household_display", "compliance_check", "redemption", "points", "created_at"]
        read_only_fields = ["compliance_check", "redemption", "points", "created_at"]


class PartnerOfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerOffer
        fields = ["id", "partner_name", "title", "description", "points_cost"]


class RedemptionSerializer(serializers.ModelSerializer):
    offer = PartnerOfferSerializer(read_only=True)

    class Meta:
        model = Redemption
        fields = ["id", "offer", "points_spent", "voucher_code", "is_used", "redeemed_at", "used_at"]
        read_only_fields = fields