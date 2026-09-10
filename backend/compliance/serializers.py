from rest_framework import serializers
from .models import ComplianceCheck
from households.models import Household


class ComplianceCheckSerializer(serializers.ModelSerializer):
    # The collector scans a QR and gets a UUID string — they don't know or
    # care about the household's internal database id. So this serializer
    # accepts a qr_code (write-only, not stored on THIS model) and resolves
    # it to the actual household internally.

    qr_code = serializers.CharField(write_only=True)
    household_display = serializers.CharField(source="household", read_only=True)

    class Meta:
        model = ComplianceCheck
        fields = ["id", "qr_code", "household_display", "photo", "waste_type", "weight_kg", "status", "notes", "checked_at"]
        read_only_fields = ["checked_at", "status"]  

    def validate_qr_code(self, value):
        try:
            household = Household.objects.get(qr_code=value)
        except Household.DoesNotExist:
            raise serializers.ValidationError("No household found for this QR code.")
       
        self.household = household
        return value

    def create(self, validated_data):
        validated_data.pop("qr_code")  # not a real model field, remove before saving
        validated_data["household"] = self.household
        return super().create(validated_data)