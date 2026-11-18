from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import ComplianceCheck
from .serializers import ComplianceCheckSerializer


class ComplianceCheckViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Staff only. Collectors submit checks; officers review them.
    Residents never touch this API: they see their results as points.
    """
    serializer_class = ComplianceCheckSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = (
            ComplianceCheck.objects.select_related("household")
            .prefetch_related("photos")
            .order_by("-checked_at", "-id")
        )
        params = self.request.query_params

        if params.get("status"):
            qs = qs.filter(status=params["status"])

        if params.get("household"):
            try:
                qs = qs.filter(household_id=int(params["household"]))
            except ValueError:
                return qs.none()

        if params.get("household_qr"):  # kept for older callers
            try:
                qs = qs.filter(household__qr_code=params["household_qr"])
            except Exception:
                return qs.none()

        if params.get("limit"):
            try:
                qs = qs[: max(1, min(int(params["limit"]), 100))]
            except ValueError:
                pass
        return qs

    @action(detail=True, methods=["patch"])
    def review(self, request, pk=None):
        """PATCH {"status": "compliant" | "non_compliant", "notes": "..."} on a pending check."""
        new_status = request.data.get("status")
        if new_status not in ("compliant", "non_compliant"):
            return Response(
                {"detail": "status must be 'compliant' or 'non_compliant'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        notes = (request.data.get("notes") or "").strip()

        with transaction.atomic():
            check = get_object_or_404(ComplianceCheck.objects.select_for_update(of=("self",)), pk=pk)
            if check.status != "pending_review":
                return Response(
                    {"detail": "This check has already been reviewed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            check.status = new_status
            if notes:
                check.notes = (f"{check.notes} | Reviewer: {notes}" if check.notes else f"Reviewer: {notes}")[:300]
            check.save()  # the points signal fires here, exactly once

        return Response(self.get_serializer(check).data)