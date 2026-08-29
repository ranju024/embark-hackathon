from rest_framework import serializers
from .models import WardSchedule, ScheduleNotice


class WardScheduleSerializer(serializers.ModelSerializer):
    pickup_day_display = serializers.CharField(source="get_pickup_day_display", read_only=True)

    class Meta:
        model = WardSchedule
        fields = ["id", "ward_number", "pickup_day", "pickup_day_display", "pickup_time"]


class ScheduleNoticeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleNotice
        fields = [
            "id", "ward_number", "date", "notice_type",
            "delayed_to_time", "reason", "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, data):
        """
        Object-level validation: delayed_to_time only makes sense
        when notice_type is "delay".
        """
        notice_type = data.get("notice_type")
        delayed_to_time = data.get("delayed_to_time")

        if notice_type == "delay" and not delayed_to_time: #delayed_to_time should be REQUIRED
            raise serializers.ValidationError({"delayed_to_time": "This field is required when notice type is delay."})

        elif notice_type == "holiday" and delayed_to_time:
            raise serializers.ValidationError({"delayed_to_time": "This field should not be set when notice type is holiday."})

        return data