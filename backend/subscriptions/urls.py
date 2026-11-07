from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import SubscriptionPlanViewSet, my_subscription, subscribe, verify_payment
from .premium_views import BulkPickupViewSet, service_preferences, service_lists, monthly_report

router = DefaultRouter()
router.register("plans", SubscriptionPlanViewSet, basename="subscription-plan")
router.register("bulk-pickups", BulkPickupViewSet, basename="bulk-pickups")

urlpatterns = [
    path("my-subscription/", my_subscription, name="my-subscription"),
    path("subscribe/", subscribe, name="subscribe"),
    path("verify-payment/", verify_payment, name="verify-payment"),
    path("preferences/", service_preferences, name="service-preferences"),
    path("service-lists/", service_lists, name="service-lists"),
    path("report/", monthly_report, name="monthly-report"),
] + router.urls