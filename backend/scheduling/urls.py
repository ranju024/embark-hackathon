from rest_framework.routers import DefaultRouter
from .views import WardScheduleViewSet, ScheduleNoticeViewSet

router = DefaultRouter()
router.register(r"ward-schedules", WardScheduleViewSet, basename="ward-schedules")
router.register(r"schedule-notices", ScheduleNoticeViewSet, basename="schedule-notices")

urlpatterns = router.urls