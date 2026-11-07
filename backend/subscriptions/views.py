from decimal import Decimal, InvalidOperation
import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from households.models import Household
from .models import SubscriptionPlan, HouseholdSubscription, Payment
from .serializers import SubscriptionPlanSerializer, HouseholdSubscriptionSerializer
from .services import get_active_subscription, can_renew, RENEWAL_WINDOW_DAYS
from .esewa import (
    build_payment_form_fields,
    decode_esewa_response,
    verify_esewa_signature,
    ESEWA_FORM_URL,
    ESEWA_STATUS_CHECK_URL,
    ESEWA_PRODUCT_CODE,
)


class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """Public catalog — visible even logged out, so it can be shown on a pricing page."""
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [AllowAny]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_subscription(request):
    """
    The active subscription if there is one; otherwise the most recent
    finished attempt (expired / failed) so the UI can explain what
    happened; otherwise null (free tier).
    """
    household = getattr(request.user, "household", None)
    if household is None:
        return Response(None)

    subscription = get_active_subscription(household)
    if subscription is None:
        subscription = (
            household.subscriptions.exclude(status__in=["pending_payment", "cancelled", "superseded"])
            .order_by("-created_at")
            .first()
        )
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

    active = get_active_subscription(household)
    if active and not can_renew(active):
        return Response(
            {
                "detail": (
                    f"You already have an active {active.plan.name} plan until {active.period_end:%b %d, %Y}. "
                    f"You can renew or switch plans in the last {RENEWAL_WINDOW_DAYS} days of the period."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        # Serialize concurrent clicks from the same household.
        Household.objects.select_for_update().get(pk=household.pk)

        # Abandoned checkouts for other plans are cancelled; a pending one
        # for THIS plan is reused instead of piling up duplicates.
        HouseholdSubscription.objects.filter(
            household=household, status="pending_payment"
        ).exclude(plan=plan).update(status="cancelled")

        subscription = HouseholdSubscription.objects.filter(
            household=household, plan=plan, status="pending_payment"
        ).first()
        if subscription is None:
            subscription = HouseholdSubscription.objects.create(
                household=household, plan=plan, status="pending_payment"
            )

        payment = Payment.objects.create(subscription=subscription, amount=plan.monthly_price_npr)

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
    Safe to call repeatedly (page refresh, React StrictMode double-run):
    a payment that is already complete just returns its subscription.
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

    try:
        payment = Payment.objects.select_related("subscription__household").get(
            transaction_uuid=response_data.get("transaction_uuid")
        )
    except (Payment.DoesNotExist, ValidationError, ValueError):
        return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)

    # 404 (not 403) so nobody can probe for other people's payment ids.
    if payment.subscription.household.owner_id != request.user.id:
        return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)

    if payment.status == "complete":
        return Response(HouseholdSubscriptionSerializer(payment.subscription).data)

    # Ask eSewa directly — the redirect alone is never trusted. This
    # network call happens BEFORE taking the database lock below.
    try:
        status_check = requests.get(ESEWA_STATUS_CHECK_URL, params={
            "product_code": ESEWA_PRODUCT_CODE,
            "total_amount": str(payment.amount),
            "transaction_uuid": str(payment.transaction_uuid),
        }, timeout=10)
        status_check.raise_for_status()
        confirmed_status = status_check.json().get("status")
    except (requests.RequestException, ValueError):
        return Response(
            {"detail": "Could not reach eSewa to confirm this payment. Please try again in a moment."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    if confirmed_status in ("PENDING", "AMBIGUOUS"):
        return Response(
            {"detail": "eSewa is still processing this payment. Please refresh in a minute."},
            status=status.HTTP_409_CONFLICT,
        )

    try:
        paid_amount = Decimal(str(response_data.get("total_amount", "")).replace(",", ""))
    except InvalidOperation:
        paid_amount = None

    with transaction.atomic():
        payment = Payment.objects.select_for_update().select_related("subscription").get(pk=payment.pk)

        if payment.status == "complete":  # another request finished it while we were talking to eSewa
            return Response(HouseholdSubscriptionSerializer(payment.subscription).data)

        if confirmed_status == "COMPLETE" and paid_amount == payment.amount:
            payment.status = "complete"
            payment.esewa_ref_id = response_data.get("transaction_code", "")
            payment.verified_at = timezone.now()
            payment.save()
            payment.subscription.activate()
            return Response(HouseholdSubscriptionSerializer(payment.subscription).data)

        payment.status = "failed"
        payment.save()
        if payment.subscription.status == "pending_payment":
            payment.subscription.status = "payment_failed"
            payment.subscription.save()

    if confirmed_status == "COMPLETE":
        detail = "Payment amount did not match the plan price."
    else:
        detail = f"Payment not completed (eSewa status: {confirmed_status})."
    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)