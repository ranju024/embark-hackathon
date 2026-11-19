from datetime import timedelta
from unittest.mock import Mock, patch

import requests
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from api.factories import (
    make_active_subscription, make_household, make_pending_payment,
    make_pending_subscription, make_plan, make_user,
)
from .models import HouseholdSubscription, Payment, SUBSCRIPTION_PERIOD_DAYS
from .views import subscribe, verify_payment

factory = APIRequestFactory()

DECODE = "subscriptions.views.decode_esewa_response"
SIGNATURE = "subscriptions.views.verify_esewa_signature"
ESEWA_GET = "subscriptions.views.requests.get"
BUILD_FIELDS = "subscriptions.views.build_payment_form_fields"


def esewa_payload(payment, total_amount=None):
    return {
        "transaction_uuid": str(payment.transaction_uuid),
        "total_amount": total_amount or str(payment.amount),
        "transaction_code": "TX123",
    }


def status_response(status):
    mock = Mock()
    mock.raise_for_status.return_value = None
    mock.json.return_value = {"status": status}
    return mock


def call_verify(user, payment, esewa_status="COMPLETE", total_amount=None,
                signature_ok=True, unreachable=False):
    """Runs verify_payment with eSewa fully mocked. Returns (response, mocked requests.get)."""
    if unreachable:
        get_kwargs = {"side_effect": requests.ConnectionError("boom")}
    else:
        get_kwargs = {"return_value": status_response(esewa_status)}

    with patch(DECODE, return_value=esewa_payload(payment, total_amount)), \
         patch(SIGNATURE, return_value=signature_ok), \
         patch(ESEWA_GET, **get_kwargs) as mocked_get:
        request = factory.post("/verify/", {"data": "encoded"}, format="json")
        force_authenticate(request, user=user)
        response = verify_payment(request)
    return response, mocked_get


class ActivateTests(TestCase):
    def setUp(self):
        self.household = make_household()
        self.plan = make_plan()
        self.today = timezone.localdate()

    def test_first_activation_starts_today(self):
        subscription = make_active_subscription(self.household, self.plan)
        self.assertEqual(subscription.status, "active")
        self.assertEqual(subscription.period_start, self.today)
        self.assertEqual(subscription.period_end, self.today + timedelta(days=SUBSCRIPTION_PERIOD_DAYS))

    def test_renewal_starts_where_current_period_ends(self):
        first = make_active_subscription(self.household, self.plan)
        second = make_pending_subscription(self.household, self.plan)
        second.activate()

        first.refresh_from_db()
        self.assertEqual(first.status, "superseded")
        self.assertEqual(second.period_start, first.period_end)
        self.assertEqual(second.period_end, first.period_end + timedelta(days=SUBSCRIPTION_PERIOD_DAYS))

    def test_lapsed_period_does_not_delay_the_new_one(self):
        first = make_active_subscription(self.household, self.plan)
        HouseholdSubscription.objects.filter(pk=first.pk).update(period_end=self.today - timedelta(days=1))

        second = make_pending_subscription(self.household, self.plan)
        second.activate()
        self.assertEqual(second.period_start, self.today)


class VerifyPaymentTests(TestCase):
    def setUp(self):
        self.user = make_user()
        self.household = make_household(owner=self.user)
        self.plan = make_plan(price="500")
        self.payment = make_pending_payment(self.household, self.plan)

    def test_successful_payment_activates_plan(self):
        response, _ = call_verify(self.user, self.payment)
        self.assertEqual(response.status_code, 200)

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "complete")
        self.assertEqual(self.payment.esewa_ref_id, "TX123")
        self.assertIsNotNone(self.payment.verified_at)

        subscription = self.payment.subscription
        subscription.refresh_from_db()
        self.assertEqual(subscription.status, "active")
        self.assertEqual(subscription.period_end - subscription.period_start,
                         timedelta(days=SUBSCRIPTION_PERIOD_DAYS))

    def test_calling_twice_is_safe_and_skips_esewa(self):
        call_verify(self.user, self.payment)
        subscription = self.payment.subscription
        subscription.refresh_from_db()
        start_after_first = subscription.period_start

        response, mocked_get = call_verify(self.user, self.payment)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(mocked_get.call_count, 0)  # already complete, eSewa not asked again

        subscription.refresh_from_db()
        self.assertEqual(subscription.period_start, start_after_first)
        self.assertEqual(HouseholdSubscription.objects.filter(household=self.household).count(), 1)

    def test_wrong_amount_fails_the_payment(self):
        response, _ = call_verify(self.user, self.payment, total_amount="100")
        self.assertEqual(response.status_code, 400)
        self.assertIn("did not match", response.data["detail"])

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "failed")
        self.payment.subscription.refresh_from_db()
        self.assertEqual(self.payment.subscription.status, "payment_failed")

    def test_cancelled_payment_fails(self):
        response, _ = call_verify(self.user, self.payment, esewa_status="CANCELED")
        self.assertEqual(response.status_code, 400)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "failed")
        self.payment.subscription.refresh_from_db()
        self.assertEqual(self.payment.subscription.status, "payment_failed")

    def test_pending_at_esewa_returns_409_and_changes_nothing(self):
        response, _ = call_verify(self.user, self.payment, esewa_status="PENDING")
        self.assertEqual(response.status_code, 409)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "initiated")
        self.payment.subscription.refresh_from_db()
        self.assertEqual(self.payment.subscription.status, "pending_payment")

    def test_esewa_unreachable_returns_502_and_changes_nothing(self):
        response, _ = call_verify(self.user, self.payment, unreachable=True)
        self.assertEqual(response.status_code, 502)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "initiated")

    def test_bad_signature_is_rejected_before_asking_esewa(self):
        response, mocked_get = call_verify(self.user, self.payment, signature_ok=False)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(mocked_get.call_count, 0)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "initiated")

    def test_someone_elses_payment_returns_404(self):
        other = make_user()
        make_household(owner=other)
        response, mocked_get = call_verify(other, self.payment)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(mocked_get.call_count, 0)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "initiated")

    def test_missing_data_returns_400(self):
        request = factory.post("/verify/", {}, format="json")
        force_authenticate(request, user=self.user)
        self.assertEqual(verify_payment(request).status_code, 400)


@override_settings(FRONTEND_BASE_URL="http://localhost:5173")
class SubscribeTests(TestCase):
    def setUp(self):
        self.user = make_user()
        self.household = make_household(owner=self.user)
        self.plan_a = make_plan("convenience", "500")
        self.plan_b = make_plan("waste-warrior-pro", "900")

    def call_subscribe(self, user, plan):
        with patch(BUILD_FIELDS, return_value={"signature": "x"}):
            request = factory.post("/subscribe/", {"plan_id": plan.id}, format="json")
            force_authenticate(request, user=user)
            return subscribe(request)

    def test_needs_a_household(self):
        response = self.call_subscribe(make_user(), self.plan_a)
        self.assertEqual(response.status_code, 400)

    def test_creates_pending_subscription_and_payment(self):
        response = self.call_subscribe(self.user, self.plan_a)
        self.assertEqual(response.status_code, 200)
        subscription = HouseholdSubscription.objects.get(household=self.household)
        self.assertEqual(subscription.status, "pending_payment")
        self.assertEqual(Payment.objects.filter(subscription=subscription).count(), 1)

    def test_same_plan_reuses_the_pending_subscription(self):
        self.call_subscribe(self.user, self.plan_a)
        self.call_subscribe(self.user, self.plan_a)
        self.assertEqual(HouseholdSubscription.objects.filter(household=self.household).count(), 1)
        self.assertEqual(Payment.objects.filter(subscription__household=self.household).count(), 2)

    def test_switching_plan_cancels_the_abandoned_checkout(self):
        self.call_subscribe(self.user, self.plan_a)
        self.call_subscribe(self.user, self.plan_b)
        statuses = dict(
            HouseholdSubscription.objects.filter(household=self.household)
            .values_list("plan__slug", "status")
        )
        self.assertEqual(statuses["convenience"], "cancelled")
        self.assertEqual(statuses["waste-warrior-pro"], "pending_payment")

    def test_blocked_while_plan_has_plenty_of_time_left(self):
        make_active_subscription(self.household, self.plan_a)
        response = self.call_subscribe(self.user, self.plan_b)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(HouseholdSubscription.objects.filter(household=self.household).count(), 1)

    def test_allowed_inside_the_renewal_window(self):
        active = make_active_subscription(self.household, self.plan_a)
        HouseholdSubscription.objects.filter(pk=active.pk).update(
            period_end=timezone.localdate() + timedelta(days=3)
        )
        response = self.call_subscribe(self.user, self.plan_b)
        self.assertEqual(response.status_code, 200)