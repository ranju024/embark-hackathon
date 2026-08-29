from datetime import date as date_cls
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import WardSchedule, ScheduleNotice
from .serializers import WardScheduleSerializer, ScheduleNoticeSerializer


class WardScheduleViewSet(viewsets.ModelViewSet):
    queryset = WardSchedule.objects.all()
    serializer_class = WardScheduleSerializer


class ScheduleNoticeViewSet(viewsets.ModelViewSet):
    queryset = ScheduleNotice.objects.all()
    serializer_class = ScheduleNoticeSerializer

    def get_queryset(self):
        queryset = ScheduleNotice.objects.all()
        ward = self.request.query_params.get("ward")
        if ward:
            queryset = queryset.filter(Q(ward_number=ward) | Q(ward_number__isnull=True))  
        return queryset

    @action(detail=False, methods=["get"])
    def effective(self, request):
        """
        GET /api/schedule-notices/effective/?ward=5&date=2026-09-20
        Returns the EFFECTIVE pickup info for a ward on a given date,
        i.e. the normal WardSchedule, UNLESS a ScheduleNotice overrides it.
        """
        ward = request.query_params.get("ward")
        date_str = request.query_params.get("date", date_cls.today())

        if not ward:
            return Response({"error": "ward is required"}, status=400)

        # get the ward's normal recurring schedule
        try:
            schedule = WardSchedule.objects.get(ward_number=ward)
        except WardSchedule.DoesNotExist:
            return Response({"error": "No schedule found for this ward"}, status=404)

        # check if a notice overrides this specific date
        notice = ScheduleNotice.objects.filter(
            date=date_str,
        ).filter(Q(ward_number=ward) | Q(ward_number__isnull=True)).first()

        if notice and notice.notice_type == "holiday":
            return Response({"status": "no_pickup", "reason": notice.reason})
        elif notice and notice.notice_type == "delay":
            return Response({"status": "delayed", "time": notice.delayed_to_time, "reason": notice.reason})
        else:
            return Response({"status": "normal", "time": schedule.pickup_time})