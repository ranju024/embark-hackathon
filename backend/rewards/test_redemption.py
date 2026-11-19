from django.db.models import Sum
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from api.factories import TempMediaMixin, make_check, make_household, make_user
from .models import GreenPointsEntry, PartnerOffer, Redemption
from .views import my_redemptions, redeem_offer

factory = APIRequestFactory()


def give_points(household, checks):
    """Each compliant check is worth +10 through the points signal."""
    for _ in range(checks):
        make_check(household, status="compliant")


def balance(household):
    return GreenPointsEntry.objects.filter(household=household).aggregate(t=Sum("points"))["t"] or 0


def redeem(user, offer_id):
    request = factory.post("/redeem/", {"offer_id": offer_id}, format="json")
    if user is not None:
        force_authenticate(request, user=user)
    return redeem_offer(request)


def list_redemptions(user):
    request = factory.get("/my-redemptions/")
    force_authenticate(request, user=user)
    return my_redemptions(request)


class RedeemOfferTests(TempMediaMixin, TestCase):
    def setUp(self):
        self.user = make_user()
        self.household = make_household(owner=self.user)
        self.offer = PartnerOffer.objects.create(
            partner_name="Test Cafe", title="Free coffee", points_cost=50
        )

    def test_successful_redemption_spends_points_and_issues_voucher(self):
        give_points(self.household, 6)  # 60 points
        response = redeem(self.user, self.offer.id)
        self.assertEqual(response.status_code, 201)

        redemption = Redemption.objects.get()
        self.assertEqual(redemption.household, self.household)
        self.assertEqual(redemption.points_spent, 50)
        self.assertTrue(redemption.voucher_code.startswith("WW-"))

        entry = GreenPointsEntry.objects.get(redemption=redemption)
        self.assertEqual(entry.points, -50)
        self.assertIsNone(entry.compliance_check)
        self.assertEqual(balance(self.household), 10)

    def test_exact_balance_is_enough(self):
        give_points(self.household, 5)  # 50 points
        response = redeem(self.user, self.offer.id)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(balance(self.household), 0)

    def test_not_enough_points_is_rejected_cleanly(self):
        give_points(self.household, 4)  # 40 points
        response = redeem(self.user, self.offer.id)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Not enough", response.data["detail"])
        self.assertEqual(Redemption.objects.count(), 0)
        self.assertEqual(balance(self.household), 40)

    def test_cannot_spend_the_same_points_twice(self):
        give_points(self.household, 6)  # 60 points, one 50-point offer fits
        self.assertEqual(redeem(self.user, self.offer.id).status_code, 201)
        self.assertEqual(redeem(self.user, self.offer.id).status_code, 400)
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(balance(self.household), 10)

    def test_inactive_offer_is_not_found(self):
        give_points(self.household, 6)
        self.offer.is_active = False
        self.offer.save()
        self.assertEqual(redeem(self.user, self.offer.id).status_code, 404)
        self.assertEqual(Redemption.objects.count(), 0)

    def test_missing_offer_id_is_not_found(self):
        self.assertEqual(redeem(self.user, None).status_code, 404)

    def test_needs_a_household(self):
        response = redeem(make_user(), self.offer.id)
        self.assertEqual(response.status_code, 400)

    def test_logged_out_is_rejected(self):
        response = redeem(None, self.offer.id)
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(Redemption.objects.count(), 0)


class MyRedemptionsTests(TempMediaMixin, TestCase):
    def setUp(self):
        self.offer = PartnerOffer.objects.create(
            partner_name="Test Cafe", title="Free coffee", points_cost=50
        )

    def test_lists_only_your_own_redemptions(self):
        mine, theirs = make_user(), make_user()
        my_household = make_household(owner=mine)
        their_household = make_household(owner=theirs)
        give_points(my_household, 5)
        give_points(their_household, 5)
        redeem(mine, self.offer.id)
        redeem(theirs, self.offer.id)

        response = list_redemptions(mine)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(Redemption.objects.count(), 2)

    def test_no_household_returns_empty_list(self):
        response = list_redemptions(make_user())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(response.data), [])