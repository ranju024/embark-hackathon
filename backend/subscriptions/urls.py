from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import SubscriptionPlanViewSet, my_subscription, subscribe, verify_payment

router = DefaultRouter()
router.register("plans", SubscriptionPlanViewSet, basename="subscription-plan")

urlpatterns = [
    path("my-subscription/", my_subscription, name="my-subscription"),
    path("subscribe/", subscribe, name="subscribe"),
    path("verify-payment/", verify_payment, name="verify-payment"),
] + router.urls