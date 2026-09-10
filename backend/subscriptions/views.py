from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
import requests

from .models import SubscriptionPlan, HouseholdSubscription, Payment
from .serializers import SubscriptionPlanSerializer, HouseholdSubscriptionSerializer
from .esewa import (
    build_payment_form_fields,
    decode_esewa_response,
    verify_esewa_signature,
    ESEWA_FORM_URL,
    ESEWA_STATUS_CHECK_URL,
    ESEWA_PRODUCT_CODE,
)


class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """Public catalog which is visible even when logged out, so it can be shown on a pricing page."""
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [AllowAny]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_subscription(request):
    household = getattr(request.user, "household", None)
    if household is None:
        return Response(None)
    subscription = household.subscriptions.order_by("-created_at").first()
    if subscription is None:
        return Response(None)
    return Response(HouseholdSubscriptionSerializer(subscription).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def subscribe(request):
    """Body: { "plan_id": 1 }. Returns the fields the frontend auto-submits to eSewa."""
    household = getattr(request.user, "household", None)
    if household is None:
        return Response({"detail": "Register a household before subscribing."}, status=status.HTTP_400_BAD_REQUEST)

    plan = get_object_or_404(SubscriptionPlan, id=request.data.get("plan_id"), is_active=True)

    subscription = HouseholdSubscription.objects.create(household=household, plan=plan, status="pending_payment")
    payment = Payment.objects.create(subscription=subscription, amount=plan.monthly_price_npr, status="initiated")

    frontend_base = settings.FRONTEND_BASE_URL
    form_fields = build_payment_form_fields(
        payment,
        success_url=f"{frontend_base}/subscription/payment-success",
        failure_url=f"{frontend_base}/subscription/payment-failure",
    )

    return Response({
        "esewa_form_url": ESEWA_FORM_URL,
        "form_fields": form_fields,
        "subscription_id": subscription.id,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_payment(request):
    """
    Body: { "data": "<base64 string eSewa redirected back with>" }
    Called by the frontend's success page (not by eSewa directly), so
    it runs behind auth. Double-checks with eSewa's own status API —
    the redirect alone is never trusted.
    """
    encoded_data = request.data.get("data")
    if not encoded_data:
        return Response({"detail": "Missing eSewa response data."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        response_data = decode_esewa_response(encoded_data)
    except Exception:
        return Response({"detail": "Could not decode eSewa response."}, status=status.HTTP_400_BAD_REQUEST)

    if not verify_esewa_signature(response_data):
        return Response({"detail": "Signature verification failed."}, status=status.HTTP_400_BAD_REQUEST)

    transaction_uuid = response_data.get("transaction_uuid")
    payment = get_object_or_404(Payment, transaction_uuid=transaction_uuid)

    status_check = requests.get(ESEWA_STATUS_CHECK_URL, params={
        "product_code": ESEWA_PRODUCT_CODE,
        "total_amount": str(payment.amount),
        "transaction_uuid": str(payment.transaction_uuid),
    }, timeout=10)
    status_check.raise_for_status()
    confirmed_status = status_check.json().get("status")

    if confirmed_status == "COMPLETE":
        payment.status = "complete"
        payment.esewa_ref_id = response_data.get("transaction_code", "")
        payment.verified_at = timezone.now()
        payment.save()
        payment.subscription.activate()
        return Response(HouseholdSubscriptionSerializer(payment.subscription).data)

    payment.status = "failed"
    payment.save()
    payment.subscription.status = "payment_failed"
    payment.subscription.save()
    return Response({"detail": f"Payment not complete (eSewa status: {confirmed_status})."}, status=status.HTTP_400_BAD_REQUEST)