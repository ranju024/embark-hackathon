from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from api.factories import (
    TempMediaMixin, make_active_subscription, make_check, make_household, make_plan, make_user,
)
from compliance.models import ComplianceCheck
from compliance.views import ComplianceCheckViewSet
from subscriptions.models import HouseholdSubscription
from .models import GreenPointsEntry
from .signals import (
    POINTS_FOR_COMPLIANT_ASSISTED, POINTS_FOR_NON_COMPLIANT_ASSISTED,
)
from .models import POINTS_FOR_COMPLIANT, POINTS_FOR_NON_COMPLIANT

factory = APIRequestFactory()
review_view = ComplianceCheckViewSet.as_view({"patch": "review"})


class AssistedPointsTests(TempMediaMixin, TestCase):
    def setUp(self):
        self.staff = make_user(is_staff=True)
        self.household = make_household()
        self.assisted_plan = make_plan("pro", "900", assisted_segregation=True)
        self.basic_plan = make_plan("convenience", "500")
        self.today = timezone.localdate()

    def review(self, check, status):
        request = factory.patch("/review/", {"status": status}, format="json")
        force_authenticate(request, user=self.staff)
        response = review_view(request, pk=check.pk)
        self.assertEqual(response.status_code, 200)

    def backdate(self, check, days):
        ComplianceCheck.objects.filter(pk=check.pk).update(
            checked_at=timezone.now() - timedelta(days=days)
        )

    def entry_points(self, check):
        return GreenPointsEntry.objects.get(compliance_check=check).points

    def test_assisted_compliant_earns_reduced_points(self):
        make_active_subscription(self.household, self.assisted_plan)
        check = make_check(self.household)
        self.review(check, "compliant")
        self.assertEqual(self.entry_points(check), POINTS_FOR_COMPLIANT_ASSISTED)

    def test_assisted_non_compliant_costs_nothing(self):
        make_active_subscription(self.household, self.assisted_plan)
        check = make_check(self.household)
        self.review(check, "non_compliant")
        # an entry still exists, it is just worth zero
        self.assertEqual(self.entry_points(check), POINTS_FOR_NON_COMPLIANT_ASSISTED)
        self.assertEqual(POINTS_FOR_NON_COMPLIANT_ASSISTED, 0)

    def test_plan_without_assisted_feature_scores_normally(self):
        make_active_subscription(self.household, self.basic_plan)
        compliant = make_check(self.household)
        failed = make_check(self.household)
        self.review(compliant, "compliant")
        self.review(failed, "non_compliant")
        self.assertEqual(self.entry_points(compliant), POINTS_FOR_COMPLIANT)
        self.assertEqual(self.entry_points(failed), POINTS_FOR_NON_COMPLIANT)

    def test_plan_that_expired_after_the_check_still_counts(self):
        HouseholdSubscription.objects.create(
            household=self.household, plan=self.assisted_plan, status="expired",
            period_start=self.today - timedelta(days=20),
            period_end=self.today - timedelta(days=5),
        )
        check = make_check(self.household)
        self.backdate(check, 10)  # checked while the plan was running
        self.review(check, "compliant")  # reviewed today, plan long expired
        self.assertEqual(self.entry_points(check), POINTS_FOR_COMPLIANT_ASSISTED)

    def test_plan_bought_after_the_check_does_not_count(self):
        check = make_check(self.household)
        self.backdate(check, 10)
        make_active_subscription(self.household, self.assisted_plan)  # starts today
        self.review(check, "compliant")
        self.assertEqual(self.entry_points(check), POINTS_FOR_COMPLIANT)

    def test_last_covered_day_counts_and_the_day_after_does_not(self):
        HouseholdSubscription.objects.create(
            household=self.household, plan=self.assisted_plan, status="expired",
            period_start=self.today - timedelta(days=20),
            period_end=self.today - timedelta(days=5),
        )
        on_last_day = make_check(self.household)
        day_after = make_check(self.household)
        self.backdate(on_last_day, 5)
        self.backdate(day_after, 4)
        self.review(on_last_day, "compliant")
        self.review(day_after, "compliant")
        self.assertEqual(self.entry_points(on_last_day), POINTS_FOR_COMPLIANT_ASSISTED)
        self.assertEqual(self.entry_points(day_after), POINTS_FOR_COMPLIANT)