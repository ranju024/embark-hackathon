from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from households.models import Household
from .models import ComplianceCheck, ComplianceCheckPhoto

MAX_PHOTOS = 5
MAX_PHOTO_BYTES = 10 * 1024 * 1024


class ComplianceCheckSerializer(serializers.ModelSerializer):
    # Write: the desk sends household_id (the API also still accepts qr_code).
    household_id = serializers.IntegerField(write_only=True, required=False)
    qr_code = serializers.CharField(write_only=True, required=False)
    photos = serializers.ListField(
        child=serializers.ImageField(), write_only=True, allow_empty=False, max_length=MAX_PHOTOS
    )

    # Read
    photo = serializers.ImageField(read_only=True)
    photo_urls = serializers.SerializerMethodField()
    household_display = serializers.CharField(source="household", read_only=True)
    ward_number = serializers.IntegerField(source="household.ward_number", read_only=True)
    house_number = serializers.CharField(source="household.house_number", read_only=True)
    owner_name = serializers.CharField(source="household.owner_name", read_only=True)

    class Meta:
        model = ComplianceCheck
        fields = [
            "id", "household_id", "qr_code", "household_display", "ward_number", "house_number",
            "owner_name", "photo", "photos", "photo_urls", "waste_type", "weight_kg",
            "status", "notes", "checked_at",
        ]
        read_only_fields = ["checked_at", "status"]

    def get_photo_urls(self, obj):
        request = self.context.get("request")

        def absolute(field_file):
            return request.build_absolute_uri(field_file.url) if request else field_file.url

        urls = [absolute(p.image) for p in obj.photos.all()]
        if not urls and obj.photo:  # checks made before multi-photo existed
            urls = [absolute(obj.photo)]
        return urls

    def validate_photos(self, photos):
        for photo in photos:
            if photo.size > MAX_PHOTO_BYTES:
                raise serializers.ValidationError("Each photo must be under 10 MB.")
        return photos

    def validate_weight_kg(self, value):
        if value <= 0:
            raise serializers.ValidationError("Weight must be more than 0 kg.")
        return value

    def validate(self, attrs):
        household_id = attrs.pop("household_id", None)
        qr_code = (attrs.pop("qr_code", "") or "").strip()
        if household_id is None and not qr_code:
            raise serializers.ValidationError("Choose a household first.")
        try:
            if household_id is not None:
                household = Household.objects.get(pk=household_id)
            else:
                household = Household.objects.get(qr_code=qr_code)
        except (Household.DoesNotExist, DjangoValidationError, ValueError):
            raise serializers.ValidationError("No household found.")
        attrs["household"] = household
        return attrs

    def create(self, validated_data):
        photos = validated_data.pop("photos")
        with transaction.atomic():
            check = ComplianceCheck.objects.create(photo="", **validated_data)
            rows = [ComplianceCheckPhoto.objects.create(compliance_check=check, image=f) for f in photos]
            check.photo = rows[0].image.name  # cover image points at the first stored file
            check.save(update_fields=["photo"])
        return check