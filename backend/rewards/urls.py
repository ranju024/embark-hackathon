from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    GreenPointsEntryViewSet,
    WardLeaderboardViewSet,
    PartnerOfferViewSet,
    my_redemptions,
    redeem_offer,
)

router = DefaultRouter()
router.register(r"points-entries", GreenPointsEntryViewSet, basename="points-entries")
router.register(r"ward-leaderboard", WardLeaderboardViewSet, basename="ward-leaderboard")
router.register(r"partner-offers", PartnerOfferViewSet, basename="partner-offers")

urlpatterns = [
    path("my-redemptions/", my_redemptions, name="my-redemptions"),
    path("redeem/", redeem_offer, name="redeem-offer"),
] + router.urls