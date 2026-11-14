from django.utils import timezone
from rest_framework import serializers
from compliance.models import ComplianceCheck
from .models import Complaint
from .services import (
    APPEAL_WINDOW_DAYS,
    MAX_OPEN_COMPLAINTS,
    appeal_deadline,
    get_review_entry,
)

MAX_PHOTO_BYTES = 5 * 1024 * 1024


class ComplaintSerializer(serializers.ModelSerializer):
    household_display = serializers.CharField(source="household", read_only=True)
    ward_number = serializers.IntegerField(source="household.ward_number", read_only=True)
    house_number = serializers.CharField(source="household.house_number", read_only=True)
    owner_name = serializers.CharField(source="household.owner_name", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    handled_by_username = serializers.SerializerMethodField()
    check_summary = serializers.SerializerMethodField()

    # Narrowed to the caller's own checks in __init__, so "doesn't exist" and
    # "belongs to someone else" give the same error and nothing leaks.
    compliance_check = serializers.PrimaryKeyRelatedField(
        queryset=ComplianceCheck.objects.none(), required=False, allow_null=True
    )

    class Meta:
        model = Complaint
        fields = [
            "id", "household_display", "ward_number", "house_number", "owner_name",
            "category", "category_display", "compliance_check", "check_summary",
            "description", "photo", "status", "status_display", "resolution_notes",
            "handled_by_username", "created_at", "updated_at", "resolved_at",
        ]
        read_only_fields = [
            "status", "resolution_notes", "created_at", "updated_at", "resolved_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        household = getattr(getattr(request, "user", None), "household", None) if request else None
        self.fields["compliance_check"].queryset = (
            ComplianceCheck.objects.filter(household=household)
            if household else ComplianceCheck.objects.none()
        )

    def get_handled_by_username(self, obj):
        return obj.handled_by.username if obj.handled_by else None

    def get_check_summary(self, obj):
        check = obj.compliance_check
        if check is None:
            return None
        return {
            "date": timezone.localtime(check.checked_at).date().isoformat(),
            "waste_type": check.get_waste_type_display(),
            "weight_kg": float(check.weight_kg),
            "status": check.status,
        }

    def validate_description(self, value):
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError("Please describe the problem in at least 10 characters.")
        if len(value) > 1000:
            raise serializers.ValidationError("Description is too long (1000 characters max).")
        return value

    def validate_photo(self, value):
        if value and value.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("Photo must be under 5 MB.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        household = getattr(request.user, "household", None)
        if household is None:
            raise serializers.ValidationError("Register a household before filing a complaint.")

        open_count = Complaint.objects.filter(
            household=household, status__in=["open", "under_review"]
        ).count()
        if open_count >= MAX_OPEN_COMPLAINTS:
            raise serializers.ValidationError(
                f"You already have {MAX_OPEN_COMPLAINTS} open complaints. Wait for some to be resolved before filing more."
            )

        check = attrs.get("compliance_check")
        if check is None:
            if attrs.get("category") == "appeal":
                raise serializers.ValidationError({"compliance_check": "Choose which result you are appealing."})
        else:
            attrs["category"] = "appeal"
            if check.status != "non_compliant":
                raise serializers.ValidationError({"compliance_check": "Only non-compliant results can be appealed."})
            entry = get_review_entry(check)
            if entry is None:
                raise serializers.ValidationError({"compliance_check": "This result hasn't been reviewed yet."})
            if timezone.now() > appeal_deadline(entry):
                raise serializers.ValidationError(
                    {"compliance_check": f"The appeal window ({APPEAL_WINDOW_DAYS} days after review) has passed."}
                )
            if Complaint.objects.filter(compliance_check=check).exists():
                raise serializers.ValidationError({"compliance_check": "This result has already been appealed."})

        attrs["household"] = household
        return attrs