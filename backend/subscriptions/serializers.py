from rest_framework import serializers
from .models import SubscriptionPlan, HouseholdSubscription, Payment


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

    class Meta:
        model = HouseholdSubscription
        fields = ["id", "plan", "status", "period_start", "period_end", "bulk_pickup_credits_used", "latest_payment"]

    def get_latest_payment(self, obj):
        payment = obj.payments.order_by("-created_at").first()
        return PaymentSerializer(payment).data if payment else None