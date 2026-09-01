from rest_framework import serializers
from .models import Complaint
from households.models import Household


class ComplaintSerializer(serializers.ModelSerializer):
    household_qr = serializers.CharField(write_only=True)
    # same pattern as ComplianceCheckSerializer — client sends the QR
    # they scanned/know, not an internal household id

    household_display = serializers.CharField(source="household", read_only=True)

    class Meta:
        model = Complaint
        fields = [
            "id", "household_qr", "household_display", "compliance_check",
            "description", "status", "resolution_notes", "created_at", "updated_at",
        ]
        read_only_fields = ["household_display", "status", "resolution_notes", "created_at", "updated_at"]
 
    def validate_household_qr(self, value):
        try:
            household = Household.objects.get(qr_code=value)
        except Household.DoesNotExist:
            raise serializers.ValidationError("No household found for this QR code.")
        self.household = household
        return value

    def create(self, validated_data):
        validated_data.pop("household_qr")
        validated_data["household"] = self.household
        return super().create(validated_data)