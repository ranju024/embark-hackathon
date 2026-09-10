from datetime import date as date_cls
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import WardSchedule, ScheduleNotice, CollectorRoute
from .serializers import WardScheduleSerializer, ScheduleNoticeSerializer, CollectorRouteSerializer


class WardScheduleViewSet(viewsets.ModelViewSet):
    queryset = WardSchedule.objects.all()
    serializer_class = WardScheduleSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticatedOrReadOnly()]


class ScheduleNoticeViewSet(viewsets.ModelViewSet):
    queryset = ScheduleNotice.objects.all()
    serializer_class = ScheduleNoticeSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def get_queryset(self):
        queryset = ScheduleNotice.objects.all()
        ward = self.request.query_params.get("ward")
        if ward:
            queryset = queryset.filter(Q(ward_number=ward) | Q(ward_number__isnull=True))
        return queryset

    @action(detail=False, methods=["get"])
    def effective(self, request):
        ward = request.query_params.get("ward")
        date_str = request.query_params.get("date", date_cls.today())

        if not ward:
            return Response({"error": "ward is required"}, status=400)

        try:
            schedule = WardSchedule.objects.get(ward_number=ward)
        except WardSchedule.DoesNotExist:
            return Response({"error": "No schedule found for this ward"}, status=404)

        notice = ScheduleNotice.objects.filter(
            date=date_str,
        ).filter(Q(ward_number=ward) | Q(ward_number__isnull=True)).first()

        if notice and notice.notice_type == "holiday":
            return Response({"status": "no_pickup", "reason": notice.reason})
        elif notice and notice.notice_type == "delay":
            return Response({"status": "delayed", "time": notice.delayed_to_time, "reason": notice.reason})
        else:
            return Response({"status": "normal", "time": schedule.pickup_time})


class CollectorRouteViewSet(viewsets.ModelViewSet):
    """
    Staff-only for management (create/list/retrieve/update/destroy/mark_status).
    update_location and mine are open to any authenticated user, with
    ownership/scoping enforced manually inside each action.
    """
    serializer_class = CollectorRouteSerializer
    queryset = CollectorRoute.objects.select_related("collector").order_by("-date")

    def get_permissions(self):
        if self.action in ["update_location", "mine"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    @action(detail=True, methods=["post"])
    def mark_status(self, request, pk=None):
        route = self.get_object()
        new_status = request.data.get("status")
        if new_status not in dict(CollectorRoute.STATUS_CHOICES):
            return Response({"detail": "Invalid status."}, status=400)

        route.status = new_status
        if new_status == "completed":
            route.completed_at = timezone.now()
        if new_status in ("completed", "missed"):
            route.current_lat = None
            route.current_lng = None
        route.save()
        return Response(CollectorRouteSerializer(route).data)

    @action(detail=True, methods=["post"])
    def update_location(self, request, pk=None):
        route = self.get_object()
        if route.collector_id != request.user.id:
            return Response({"detail": "Only the assigned collector can update this route's location."}, status=403)

        if route.status not in ("assigned", "in_progress"):
            return Response(
                {"detail": f"This route is {route.status} — broadcasting is no longer allowed."},
                status=400,
            )

        lat = request.data.get("current_lat")
        lng = request.data.get("current_lng")
        if lat is None or lng is None:
            return Response({"detail": "current_lat and current_lng are required."}, status=400)

        route.current_lat = lat
        route.current_lng = lng
        route.last_location_update = timezone.now()
        if route.status == "assigned":
            route.status = "in_progress"
        route.save()
        return Response(CollectorRouteSerializer(route).data)

    @action(detail=False, methods=["get"])
    def mine(self, request):
        """
        Staff: ALL of their own routes for today (a collector can be
        assigned multiple wards in one day), not just one.
        Resident: today's in_progress route for their own ward, if any,
        only one route can exist per ward per day (unique_together enforces that).
        """
        today = timezone.localdate()

        if request.user.is_staff:
            routes = CollectorRoute.objects.filter(collector=request.user, date=today).order_by("ward_number")
            return Response(CollectorRouteSerializer(routes, many=True).data)

        household = getattr(request.user, "household", None)
        if household is None:
            return Response(None)
        route = CollectorRoute.objects.filter(
            ward_number=household.ward_number, date=today, status="in_progress"
        ).first()
        if route is None:
            return Response(None)
        return Response(CollectorRouteSerializer(route).data)