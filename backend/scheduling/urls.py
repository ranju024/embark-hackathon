from rest_framework.routers import DefaultRouter
from .views import WardScheduleViewSet, ScheduleNoticeViewSet, CollectorRouteViewSet

router = DefaultRouter()
router.register(r"ward-schedules", WardScheduleViewSet, basename="ward-schedules")
router.register(r"schedule-notices", ScheduleNoticeViewSet, basename="schedule-notices")
router.register(r"collector-routes", CollectorRouteViewSet, basename="collector-routes")

urlpatterns = router.urls