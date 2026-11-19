import itertools
import shutil
import tempfile
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from compliance.models import ComplianceCheck
from households.models import Household
from subscriptions.models import HouseholdSubscription, Payment, SubscriptionPlan

_counter = itertools.count(1)
DEFAULT_PASSWORD = "pass12345"


def make_user(username=None, is_staff=False):
    username = username or f"user{next(_counter)}"
    return User.objects.create_user(username=username, password=DEFAULT_PASSWORD, is_staff=is_staff)


def make_household(owner=None, ward=1, house_number=None):
    return Household.objects.create(
        owner=owner or make_user(),
        ward_number=ward,
        house_number=house_number or str(next(_counter)),
        owner_name="Test Owner",
        phone_number="9841234567",
    )


def make_check(household, status="pending_review", waste_type="organic", weight="1.50", notes=""):
    return ComplianceCheck.objects.create(
        household=household,
        photo=SimpleUploadedFile("check.jpg", b"fake-image-bytes", content_type="image/jpeg"),
        status=status,
        waste_type=waste_type,
        weight_kg=Decimal(weight),
        notes=notes,
    )


def make_plan(slug="convenience", price="500", **features):
    return SubscriptionPlan.objects.create(
        name=slug.replace("-", " ").title(),
        slug=slug,
        monthly_price_npr=Decimal(price),
        **features,
    )


def make_pending_subscription(household, plan):
    return HouseholdSubscription.objects.create(household=household, plan=plan, status="pending_payment")


def make_active_subscription(household, plan):
    subscription = make_pending_subscription(household, plan)
    subscription.activate()
    return subscription


def make_pending_payment(household, plan):
    subscription = make_pending_subscription(household, plan)
    return Payment.objects.create(subscription=subscription, amount=plan.monthly_price_npr)


class TempMediaMixin:
    """Put before TestCase in the bases, so uploaded test photos go to a temp folder."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media_dir = tempfile.mkdtemp()
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_dir)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media_override.disable()
        shutil.rmtree(cls._media_dir, ignore_errors=True)
        super().tearDownClass()