from rest_framework.routers import DefaultRouter
from .views import GreenPointsEntryViewSet, WardLeaderboardViewSet

router = DefaultRouter()
router.register(r"points-entries", GreenPointsEntryViewSet, basename="points-entries")
router.register(r"ward-leaderboard", WardLeaderboardViewSet, basename="ward-leaderboard")

urlpatterns = router.urls