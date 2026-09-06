from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import health_check, RegisterView, ItemViewSet, chat, me

router = DefaultRouter()
router.register(r"items", ItemViewSet, basename="item")

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/me/", me, name="me"),
    path("chat/", chat, name="chat"),
    path("", include(router.urls)),
]
