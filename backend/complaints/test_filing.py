from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from api.factories import TempMediaMixin, make_check, make_household, make_user
from rewards.models import GreenPointsEntry
from .models import Complaint
from .services import MAX_OPEN_COMPLAINTS
from .views import ComplaintViewSet

factory = APIRequestFactory()
create_view = ComplaintViewSet.as_view({"post": "create"})
list_view = ComplaintViewSet.as_view({"get": "list"})
detail_view = ComplaintViewSet.as_view({"get": "retrieve"})
appealable_view = ComplaintViewSet.as_view({"get": "appealable_checks"})

GOOD_TEXT = "The bag was never collected."


def send(view, user, method="get", data=None, **kwargs):
    build = getattr(factory, method)
    if method == "post":
        request = build("/x/", data, format="json")
    else:
        request = build("/x/", data or {})
    if user is not None:
        force_authenticate(request, user=user)
    return view(request, **kwargs)


def results(response):
    data = response.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


def file_complaint(user, **payload):
    payload.setdefault("description", GOOD_TEXT)
    return send(create_view, user, "post", payload)


def age_review(check, days):
    """Pretend the officer reviewed this check `days` days ago."""
    GreenPointsEntry.objects.filter(compliance_check=check).update(
        created_at=timezone.now() - timedelta(days=days)
    )


class FilingTests(TempMediaMixin, TestCase):
    def setUp(self):
        self.user = make_user()
        self.household = make_household(owner=self.user)

    def make_complaints(self, count, status="open"):
        for _ in range(count):
            Complaint.objects.create(household=self.household, description=GOOD_TEXT, status=status)

    def test_general_complaint_is_filed(self):
        response = file_complaint(self.user, category="missed_pickup")
        self.assertEqual(response.status_code, 201)
        complaint = Complaint.objects.get()
        self.assertEqual(complaint.household, self.household)
        self.assertEqual(complaint.category, "missed_pickup")
        self.assertEqual(complaint.status, "open")
        self.assertIsNone(complaint.compliance_check)

    def test_client_cannot_set_status(self):
        response = file_complaint(self.user, status="resolved", resolution_notes="done")
        self.assertEqual(response.status_code, 201)
        complaint = Complaint.objects.get()
        self.assertEqual(complaint.status, "open")
        self.assertEqual(complaint.resolution_notes, "")

    def test_description_under_ten_characters_is_rejected(self):
        self.assertEqual(file_complaint(self.user, description="x" * 9).status_code, 400)
        self.assertEqual(file_complaint(self.user, description="   short   ").status_code, 400)
        self.assertEqual(Complaint.objects.count(), 0)

    def test_description_of_exactly_ten_characters_is_accepted(self):
        self.assertEqual(file_complaint(self.user, description="x" * 10).status_code, 201)

    def test_description_over_1000_characters_is_rejected(self):
        self.assertEqual(file_complaint(self.user, description="x" * 1001).status_code, 400)
        self.assertEqual(file_complaint(self.user, description="x" * 1000).status_code, 201)

    def test_appeal_category_without_a_check_is_rejected(self):
        response = file_complaint(self.user, category="appeal")
        self.assertEqual(response.status_code, 400)
        self.assertIn("compliance_check", response.data)

    def test_needs_a_household(self):
        response = file_complaint(make_user())
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Complaint.objects.count(), 0)

    def test_logged_out_is_rejected(self):
        response = file_complaint(None)
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(Complaint.objects.count(), 0)

    def test_open_complaint_cap(self):
        self.make_complaints(MAX_OPEN_COMPLAINTS - 1)
        self.assertEqual(file_complaint(self.user).status_code, 201)  # reaches the cap
        response = file_complaint(self.user)
        self.assertEqual(response.status_code, 400)
        self.assertIn("open complaints", str(response.data))
        self.assertEqual(Complaint.objects.count(), MAX_OPEN_COMPLAINTS)

    def test_under_review_counts_toward_the_cap(self):
        self.make_complaints(MAX_OPEN_COMPLAINTS, status="under_review")
        self.assertEqual(file_complaint(self.user).status_code, 400)

    def test_closed_complaints_do_not_count_toward_the_cap(self):
        self.make_complaints(MAX_OPEN_COMPLAINTS, status="resolved")
        self.assertEqual(file_complaint(self.user).status_code, 201)


class AppealFilingTests(TempMediaMixin, TestCase):
    def setUp(self):
        self.user = make_user()
        self.household = make_household(owner=self.user)

    def appeal(self, check, user=None):
        return file_complaint(user or self.user, compliance_check=check.id)

    def test_valid_appeal_is_filed_and_marked_as_appeal(self):
        check = make_check(self.household, status="non_compliant")
        response = file_complaint(self.user, compliance_check=check.id, category="other")
        self.assertEqual(response.status_code, 201)
        complaint = Complaint.objects.get()
        self.assertEqual(complaint.compliance_check, check)
        self.assertEqual(complaint.category, "appeal")  # forced, whatever the client sent

    def test_pending_check_cannot_be_appealed(self):
        check = make_check(self.household, status="pending_review")
        response = self.appeal(check)
        self.assertEqual(response.status_code, 400)
        self.assertIn("compliance_check", response.data)
        self.assertEqual(Complaint.objects.count(), 0)

    def test_compliant_check_cannot_be_appealed(self):
        check = make_check(self.household, status="compliant")
        response = self.appeal(check)
        self.assertEqual(response.status_code, 400)
        self.assertIn("non-compliant", str(response.data))

    def test_non_compliant_check_without_a_review_entry_cannot_be_appealed(self):
        check = make_check(self.household, status="non_compliant")
        GreenPointsEntry.objects.filter(compliance_check=check).delete()
        response = self.appeal(check)
        self.assertEqual(response.status_code, 400)
        self.assertIn("reviewed", str(response.data))

    def test_appeal_after_the_window_is_rejected(self):
        check = make_check(self.household, status="non_compliant")
        age_review(check, 8)
        response = self.appeal(check)
        self.assertEqual(response.status_code, 400)
        self.assertIn("window", str(response.data))
        self.assertEqual(Complaint.objects.count(), 0)

    def test_appeal_inside_the_window_is_allowed(self):
        check = make_check(self.household, status="non_compliant")
        age_review(check, 6)
        self.assertEqual(self.appeal(check).status_code, 201)

    def test_a_check_can_only_be_appealed_once(self):
        check = make_check(self.household, status="non_compliant")
        self.assertEqual(self.appeal(check).status_code, 201)
        response = self.appeal(check)
        self.assertEqual(response.status_code, 400)
        self.assertIn("already been appealed", str(response.data))
        self.assertEqual(Complaint.objects.count(), 1)

    def test_cannot_appeal_someone_elses_check(self):
        other_household = make_household()
        check = make_check(other_household, status="non_compliant")
        response = self.appeal(check)
        self.assertEqual(response.status_code, 400)
        self.assertIn("compliance_check", response.data)
        self.assertEqual(Complaint.objects.count(), 0)


class VisibilityTests(TempMediaMixin, TestCase):
    def setUp(self):
        self.staff = make_user(is_staff=True)
        self.alice = make_user()
        self.bob = make_user()
        self.alice_home = make_household(owner=self.alice, ward=1)
        self.bob_home = make_household(owner=self.bob, ward=2)
        self.alice_complaint = Complaint.objects.create(household=self.alice_home, description=GOOD_TEXT)
        self.bob_complaint = Complaint.objects.create(household=self.bob_home, description=GOOD_TEXT)

    def test_resident_sees_only_their_own(self):
        response = send(list_view, self.alice)
        self.assertEqual([c["id"] for c in results(response)], [self.alice_complaint.id])

    def test_resident_cannot_widen_the_list_with_the_ward_filter(self):
        response = send(list_view, self.alice, data={"ward": "2"})
        self.assertEqual([c["id"] for c in results(response)], [self.alice_complaint.id])

    def test_staff_sees_everything(self):
        response = send(list_view, self.staff)
        self.assertEqual({c["id"] for c in results(response)},
                         {self.alice_complaint.id, self.bob_complaint.id})

    def test_staff_ward_filter(self):
        response = send(list_view, self.staff, data={"ward": "2"})
        self.assertEqual([c["id"] for c in results(response)], [self.bob_complaint.id])

    def test_active_filter_hides_closed_complaints(self):
        Complaint.objects.filter(pk=self.bob_complaint.pk).update(status="under_review")
        closed = Complaint.objects.create(household=self.alice_home, description=GOOD_TEXT, status="resolved")
        response = send(list_view, self.staff, data={"status": "active"})
        ids = {c["id"] for c in results(response)}
        self.assertEqual(ids, {self.alice_complaint.id, self.bob_complaint.id})
        self.assertNotIn(closed.id, ids)

    def test_cannot_open_someone_elses_complaint(self):
        response = send(detail_view, self.alice, pk=self.bob_complaint.pk)
        self.assertEqual(response.status_code, 404)

    def test_can_open_your_own_complaint(self):
        response = send(detail_view, self.alice, pk=self.alice_complaint.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.alice_complaint.id)


class AppealableChecksTests(TempMediaMixin, TestCase):
    def test_lists_only_what_can_still_be_appealed(self):
        user = make_user()
        household = make_household(owner=user)

        fresh = make_check(household, status="non_compliant")

        too_old = make_check(household, status="non_compliant")
        age_review(too_old, 8)

        make_check(household, status="compliant")

        already_appealed = make_check(household, status="non_compliant")
        Complaint.objects.create(
            household=household, compliance_check=already_appealed,
            category="appeal", description=GOOD_TEXT,
        )

        make_check(make_household(), status="non_compliant")  # someone else's

        response = send(appealable_view, user)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([c["id"] for c in response.data], [fresh.id])
        self.assertIn("appeal_deadline", response.data[0])

    def test_no_household_returns_empty_list(self):
        response = send(appealable_view, make_user())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(response.data), [])