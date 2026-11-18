from django.contrib.auth.models import User
from django.db.models import Count, Q, Sum
from rest_framework import generics, permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from compliance.models import ComplianceCheck
from households.models import Household
from scheduling.models import WardSchedule

from .chat import chat  # noqa: F401  (re-exported: urls.py imports it from here)
from .models import Item
from .serializers import ItemSerializer, RegisterSerializer


@api_view(["GET"])
def health_check(request):
    """Hit this first to confirm frontend <-> backend wiring works."""
    return Response({"status": "ok", "message": "backend is alive"})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    """
    GET /api/auth/me/
    Lets the frontend find out basic info about whoever's currently
    logged in — specifically whether they're staff, since login alone
    only returns tokens, never tells you anything ABOUT the account.
    """
    return Response({
        "username": request.user.username,
        "is_staff": request.user.is_staff,
    })


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class ItemViewSet(viewsets.ModelViewSet):
    """
    Gives you GET/POST /api/items/ and GET/PUT/PATCH/DELETE /api/items/<id>/
    for free. Copy this pattern for every other model you add.
    """
    serializer_class = ItemSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Item.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_stats(request):
    """
    GET /api/stats/summary/
    Aggregate-only numbers, safe to show on a logged-out marketing page.
    Never returns anything tied to an individual household.
    """
    total_households = Household.objects.count()
    active_wards = WardSchedule.objects.values("ward_number").distinct().count()
    total_weight_kg = ComplianceCheck.objects.aggregate(total=Sum("weight_kg"))["total"] or 0

    reviewed_checks = ComplianceCheck.objects.exclude(status="pending_review")
    reviewed_count = reviewed_checks.count()
    compliant_count = reviewed_checks.filter(status="compliant").count()
    compliance_rate = round((compliant_count / reviewed_count) * 100) if reviewed_count > 0 else None

    return Response({
        "total_households": total_households,
        "active_wards": active_wards,
        "total_weight_kg": float(total_weight_kg),
        "compliance_rate": compliance_rate,  # None if nothing reviewed yet; the frontend handles that
    })


@api_view(["GET"])
@permission_classes([permissions.IsAdminUser])
def ward_compliance_stats(request):
    """GET /api/ward-stats/ — staff-only per-ward compliance + waste-type breakdown."""
    stats = (
        ComplianceCheck.objects.exclude(status="pending_review")
        .values("household__ward_number")
        .annotate(
            total=Count("id"),
            compliant=Count("id", filter=Q(status="compliant")),
            non_compliant=Count("id", filter=Q(status="non_compliant")),
            organic=Count("id", filter=Q(waste_type="organic")),
            dry=Count("id", filter=Q(waste_type="dry")),
            both=Count("id", filter=Q(waste_type="both")),
            total_weight_kg=Sum("weight_kg"),
        )
        .order_by("household__ward_number")
    )
    results = [
        {
            "ward_number": s["household__ward_number"],
            "total": s["total"],
            "compliant": s["compliant"],
            "non_compliant": s["non_compliant"],
            "compliance_rate": round((s["compliant"] / s["total"]) * 100) if s["total"] else None,
            "organic": s["organic"], "dry": s["dry"], "both": s["both"],
            "total_weight_kg": float(s["total_weight_kg"] or 0),
        }
        for s in stats
    ]
    return Response(results)


@api_view(["GET"])
@permission_classes([permissions.IsAdminUser])
def staff_users(request):
    """GET /api/staff-users/ — for the route-assignment dropdown on the ward dashboard."""
    staff = User.objects.filter(is_staff=True).order_by("username")
    return Response([{"id": u.id, "username": u.username} for u in staff])