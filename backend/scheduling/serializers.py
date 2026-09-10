from datetime import date as date_cls
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import WardSchedule, ScheduleNotice, CollectorRoute


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
        notice_type = data.get("notice_type")
        delayed_to_time = data.get("delayed_to_time")

        if notice_type == "delay" and not delayed_to_time:
            raise serializers.ValidationError({"delayed_to_time": "This field is required when notice type is delay."})
        elif notice_type == "holiday" and delayed_to_time:
            raise serializers.ValidationError({"delayed_to_time": "This field should not be set when notice type is holiday."})

        date_value = data.get("date")
        if date_value and date_value < date_cls.today():
            raise serializers.ValidationError({"date": "Notice date cannot be in the past."})

        return data


class CollectorRouteSerializer(serializers.ModelSerializer):
    collector_username = serializers.CharField(source="collector.username", read_only=True)
    collector = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_staff=True))

    class Meta:
        model = CollectorRoute
        fields = [
            "id", "ward_number", "collector", "collector_username", "date", "status", "notes",
            "current_lat", "current_lng", "last_location_update", "created_at", "completed_at",
        ]
        read_only_fields = ["status", "current_lat", "current_lng", "last_location_update", "created_at", "completed_at"]