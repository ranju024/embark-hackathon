from rest_framework.routers import DefaultRouter
from .views import HouseholdViewSet

router = DefaultRouter()
router.register(r"households", HouseholdViewSet, basename="households")

urlpatterns = router.urls