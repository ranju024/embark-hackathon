from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from api.factories import TempMediaMixin, make_check, make_household, make_user
from compliance.views import ComplianceCheckViewSet
from .models import GreenPointsEntry, POINTS_FOR_COMPLIANT, POINTS_FOR_NON_COMPLIANT

factory = APIRequestFactory()
review_view = ComplianceCheckViewSet.as_view({"patch": "review"})


class ReviewPointsTests(TempMediaMixin, TestCase):
    def setUp(self):
        self.staff = make_user(is_staff=True)
        self.household = make_household()
        self.check = make_check(self.household)

    def review(self, user, payload):
        request = factory.patch("/review/", payload, format="json")
        if user is not None:
            force_authenticate(request, user=user)
        # harmless if the points signal runs immediately; needed if it uses on_commit
        with self.captureOnCommitCallbacks(execute=True):
            return review_view(request, pk=self.check.pk)

    def test_new_check_awards_nothing_until_reviewed(self):
        self.assertEqual(GreenPointsEntry.objects.count(), 0)

    def test_compliant_review_awards_points_once(self):
        response = self.review(self.staff, {"status": "compliant"})
        self.assertEqual(response.status_code, 200)

        self.check.refresh_from_db()
        self.assertEqual(self.check.status, "compliant")
        entry = GreenPointsEntry.objects.get()
        self.assertEqual(entry.household, self.household)
        self.assertEqual(entry.compliance_check, self.check)
        self.assertEqual(entry.points, POINTS_FOR_COMPLIANT)

    def test_non_compliant_review_deducts_points(self):
        response = self.review(self.staff, {"status": "non_compliant"})
        self.assertEqual(response.status_code, 200)
        entry = GreenPointsEntry.objects.get()
        self.assertEqual(entry.points, POINTS_FOR_NON_COMPLIANT)

    def test_second_review_is_rejected_and_points_do_not_change(self):
        self.review(self.staff, {"status": "compliant"})
        response = self.review(self.staff, {"status": "non_compliant"})
        self.assertEqual(response.status_code, 400)

        self.check.refresh_from_db()
        self.assertEqual(self.check.status, "compliant")
        self.assertEqual(GreenPointsEntry.objects.count(), 1)
        self.assertEqual(GreenPointsEntry.objects.get().points, POINTS_FOR_COMPLIANT)

    def test_invalid_status_is_rejected(self):
        for bad in ("pending_review", "banana", ""):
            response = self.review(self.staff, {"status": bad})
            self.assertEqual(response.status_code, 400)
        self.check.refresh_from_db()
        self.assertEqual(self.check.status, "pending_review")
        self.assertEqual(GreenPointsEntry.objects.count(), 0)

    def test_resident_cannot_review(self):
        resident = make_user()
        response = self.review(resident, {"status": "compliant"})
        self.assertEqual(response.status_code, 403)
        self.check.refresh_from_db()
        self.assertEqual(self.check.status, "pending_review")
        self.assertEqual(GreenPointsEntry.objects.count(), 0)

    def test_anonymous_cannot_review(self):
        response = self.review(None, {"status": "compliant"})
        self.assertIn(response.status_code, (401, 403))
        self.check.refresh_from_db()
        self.assertEqual(self.check.status, "pending_review")

    def test_reviewer_note_is_appended_to_collector_note(self):
        self.check.notes = "Dry bag mixed"
        self.check.save()
        self.review(self.staff, {"status": "non_compliant", "notes": "Confirmed from photos"})
        self.check.refresh_from_db()
        self.assertEqual(self.check.notes, "Dry bag mixed | Reviewer: Confirmed from photos")

    def test_notes_never_exceed_300_characters(self):
        self.check.notes = "x" * 290
        self.check.save()
        self.review(self.staff, {"status": "compliant", "notes": "y" * 50})
        self.check.refresh_from_db()
        self.assertLessEqual(len(self.check.notes), 300)


class PointsEntryConstraintTests(TestCase):
    def test_entry_with_no_source_is_rejected(self):
        household = make_household()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                GreenPointsEntry.objects.create(household=household, points=5)