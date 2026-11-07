from rest_framework import serializers
from .models import SubscriptionPlan, HouseholdSubscription, Payment, BulkPickupRequest
from .services import get_days_remaining, can_renew


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id", "name", "slug", "description", "monthly_price_npr",
            "assisted_segregation", "priority_pickup", "compost_addon",
            "bulk_pickup_credits_per_month", "monthly_compliance_report",
        ]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "transaction_uuid", "amount", "status", "esewa_ref_id", "created_at", "verified_at"]
        read_only_fields = fields


class HouseholdSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    latest_payment = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    can_renew = serializers.SerializerMethodField()

    class Meta:
        model = HouseholdSubscription
        fields = [
            "id", "plan", "status", "period_start", "period_end",
            "days_remaining", "can_renew", "bulk_pickup_credits_used", "latest_payment",
        ]

    def get_latest_payment(self, obj):
        payment = obj.payments.order_by("-created_at").first()
        return PaymentSerializer(payment).data if payment else None

    def get_days_remaining(self, obj):
        return get_days_remaining(obj)

    def get_can_renew(self, obj):
        return can_renew(obj)


class BulkPickupRequestSerializer(serializers.ModelSerializer):
    ward_number = serializers.IntegerField(source="household.ward_number", read_only=True)
    house_number = serializers.CharField(source="household.house_number", read_only=True)
    owner_name = serializers.CharField(source="household.owner_name", read_only=True)

    class Meta:
        model = BulkPickupRequest
        fields = [
            "id", "ward_number", "house_number", "owner_name",
            "pickup_date", "description", "status", "created_at", "completed_at",
        ]
        read_only_fields = fields