from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from api.factories import (
    TempMediaMixin, make_active_subscription, make_check, make_household, make_plan, make_user,
)
from rewards.models import (
    GreenPointsEntry, POINTS_FOR_COMPLIANT, POINTS_FOR_NON_COMPLIANT,
)
from rewards.services import get_total_points
from rewards.signals import POINTS_FOR_COMPLIANT_ASSISTED, POINTS_FOR_NON_COMPLIANT_ASSISTED
from .models import Complaint
from .views import ComplaintViewSet

factory = APIRequestFactory()
create_view = ComplaintViewSet.as_view({"post": "create"})
review_view = ComplaintViewSet.as_view({"post": "review"})
resolve_view = ComplaintViewSet.as_view({"post": "resolve"})

GOOD_TEXT = "The bag was never collected."


def post(view, user, data=None, **kwargs):
    request = factory.post("/x/", data, format="json")
    if user is not None:
        force_authenticate(request, user=user)
    return view(request, **kwargs)


def resolve(user, complaint, status="resolved", notes="Checked the photos again."):
    return post(resolve_view, user, {"status": status, "resolution_notes": notes}, pk=complaint.pk)


class StaffActionBase(TempMediaMixin, TestCase):
    def setUp(self):
        self.staff = make_user(is_staff=True)
        self.resident = make_user()
        self.household = make_household(owner=self.resident)
        self.complaint = Complaint.objects.create(household=self.household, description=GOOD_TEXT)


class ReviewTests(StaffActionBase):
    def test_staff_moves_open_complaint_to_review(self):
        response = post(review_view, self.staff, pk=self.complaint.pk)
        self.assertEqual(response.status_code, 200)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, "under_review")
        self.assertEqual(self.complaint.handled_by, self.staff)

    def test_only_open_complaints_can_be_reviewed(self):
        post(review_view, self.staff, pk=self.complaint.pk)
        response = post(review_view, self.staff, pk=self.complaint.pk)
        self.assertEqual(response.status_code, 400)

    def test_resident_cannot_review(self):
        response = post(review_view, self.resident, pk=self.complaint.pk)
        self.assertEqual(response.status_code, 403)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, "open")

    def test_logged_out_cannot_review(self):
        response = post(review_view, None, pk=self.complaint.pk)
        self.assertIn(response.status_code, (401, 403))


class ResolveTests(StaffActionBase):
    def test_resolving_a_general_complaint(self):
        response = resolve(self.staff, self.complaint, "resolved", "Collector sent back.")
        self.assertEqual(response.status_code, 200)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, "resolved")
        self.assertEqual(self.complaint.resolution_notes, "Collector sent back.")
        self.assertEqual(self.complaint.handled_by, self.staff)
        self.assertIsNotNone(self.complaint.resolved_at)

    def test_rejecting_a_complaint(self):
        response = resolve(self.staff, self.complaint, "rejected", "Not a valid case.")
        self.assertEqual(response.status_code, 200)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, "rejected")

    def test_can_resolve_straight_from_under_review(self):
        post(review_view, self.staff, pk=self.complaint.pk)
        self.assertEqual(resolve(self.staff, self.complaint).status_code, 200)

    def test_status_must_be_resolved_or_rejected(self):
        for bad in ("open", "under_review", "banana", None):
            response = post(resolve_view, self.staff,
                            {"status": bad, "resolution_notes": "ok"}, pk=self.complaint.pk)
            self.assertEqual(response.status_code, 400)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, "open")

    def test_explanation_is_required(self):
        response = resolve(self.staff, self.complaint, notes="   ")
        self.assertEqual(response.status_code, 400)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, "open")

    def test_explanation_over_300_characters_is_rejected(self):
        self.assertEqual(resolve(self.staff, self.complaint, notes="x" * 301).status_code, 400)
        self.assertEqual(resolve(self.staff, self.complaint, notes="x" * 300).status_code, 200)

    def test_closed_complaint_cannot_be_resolved_again(self):
        resolve(self.staff, self.complaint, "rejected", "No.")
        response = resolve(self.staff, self.complaint, "resolved", "Changed my mind.")
        self.assertEqual(response.status_code, 400)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, "rejected")

    def test_resident_cannot_resolve(self):
        response = resolve(self.resident, self.complaint)
        self.assertEqual(response.status_code, 403)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, "open")

    def test_unknown_complaint_is_404(self):
        request_data = {"status": "resolved", "resolution_notes": "ok"}
        self.assertEqual(post(resolve_view, self.staff, request_data, pk=999999).status_code, 404)


class UpheldAppealTests(StaffActionBase):
    def setUp(self):
        super().setUp()
        self.check = make_check(self.household, status="non_compliant")  # worth -15
        self.appeal = self.file_appeal()

    def file_appeal(self):
        response = post(create_view, self.resident,
                        {"compliance_check": self.check.id, "description": "I sorted this correctly."})
        self.assertEqual(response.status_code, 201)
        return Complaint.objects.get(pk=response.data["id"])

    def entries(self):
        return GreenPointsEntry.objects.filter(compliance_check=self.check)

    def test_upheld_appeal_flips_the_check_and_fixes_the_points(self):
        self.assertEqual(get_total_points(self.household), POINTS_FOR_NON_COMPLIANT)

        response = resolve(self.staff, self.appeal, "resolved", "Photos show correct sorting.")
        self.assertEqual(response.status_code, 200)

        self.check.refresh_from_db()
        self.assertEqual(self.check.status, "compliant")
        self.assertEqual(self.entries().count(), 1)  # corrected in place, not duplicated
        self.assertEqual(self.entries().get().points, POINTS_FOR_COMPLIANT)
        self.assertEqual(get_total_points(self.household), POINTS_FOR_COMPLIANT)

        self.appeal.refresh_from_db()
        self.assertEqual(self.appeal.status, "resolved")

    def test_rejected_appeal_changes_nothing(self):
        response = resolve(self.staff, self.appeal, "rejected", "Bag was clearly mixed.")
        self.assertEqual(response.status_code, 200)

        self.check.refresh_from_db()
        self.assertEqual(self.check.status, "non_compliant")
        self.assertEqual(self.entries().get().points, POINTS_FOR_NON_COMPLIANT)
        self.appeal.refresh_from_db()
        self.assertEqual(self.appeal.status, "rejected")

    def test_resident_cannot_uphold_their_own_appeal(self):
        response = resolve(self.resident, self.appeal)
        self.assertEqual(response.status_code, 403)
        self.check.refresh_from_db()
        self.assertEqual(self.check.status, "non_compliant")
        self.assertEqual(self.entries().get().points, POINTS_FOR_NON_COMPLIANT)


class UpheldAssistedAppealTests(StaffActionBase):
    def test_upheld_appeal_on_an_assisted_plan_pays_the_assisted_rate(self):
        plan = make_plan("pro", "900", assisted_segregation=True)
        make_active_subscription(self.household, plan)  # covers today, before the check
        check = make_check(self.household, status="non_compliant")  # worth 0 on assisted
        self.assertEqual(get_total_points(self.household), POINTS_FOR_NON_COMPLIANT_ASSISTED)

        response = post(create_view, self.resident,
                        {"compliance_check": check.id, "description": "I sorted this correctly."})
        self.assertEqual(response.status_code, 201)
        appeal = Complaint.objects.get(pk=response.data["id"])

        self.assertEqual(resolve(self.staff, appeal).status_code, 200)

        check.refresh_from_db()
        self.assertEqual(check.status, "compliant")
        entries = GreenPointsEntry.objects.filter(compliance_check=check)
        self.assertEqual(entries.count(), 1)
        self.assertEqual(entries.get().points, POINTS_FOR_COMPLIANT_ASSISTED)