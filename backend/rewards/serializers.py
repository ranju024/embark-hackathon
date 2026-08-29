from rest_framework import serializers
from django.db.models import Sum
from .models import GreenPointsEntry
from households.models import Household


class GreenPointsEntrySerializer(serializers.ModelSerializer):
    household_display = serializers.CharField(source="household", read_only=True)

    class Meta:
        model = GreenPointsEntry
        fields = ["id", "household_display", "compliance_check", "points", "created_at"]
        read_only_fields = ["compliance_check", "points", "created_at"]



