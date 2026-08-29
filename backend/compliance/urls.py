from rest_framework.routers import DefaultRouter
from .views import ComplianceCheckViewSet

router = DefaultRouter()
router.register(r"compliance-checks", ComplianceCheckViewSet, basename="compliance-checks")

urlpatterns = router.urls