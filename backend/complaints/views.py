from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import Complaint
from .serializers import ComplaintSerializer
from .services import appeal_deadline, appealable_checks, overturn_check


def _bad(detail, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": detail}, status=code)


class ComplaintViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Residents: file, list and view their OWN complaints (and appeals).
    Staff: see everything, move complaints to review, and resolve/reject.
    There is deliberately no update or delete — a filed complaint is a record.
    """
    serializer_class = ComplaintSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ("review", "resolve"):
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Complaint.objects.select_related("household", "compliance_check", "handled_by")
        user = self.request.user
        if not user.is_staff:
            qs = qs.filter(household__owner=user)

        status_param = self.request.query_params.get("status")
        if status_param == "active":
            qs = qs.filter(status__in=["open", "under_review"])
        elif status_param:
            qs = qs.filter(status=status_param)

        ward = self.request.query_params.get("ward")
        if ward and user.is_staff:
            try:
                qs = qs.filter(household__ward_number=int(ward))
            except ValueError:
                pass
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            # Lost a race with another appeal for the same result.
            raise serializers.ValidationError({"compliance_check": "This result has already been appealed."})

    @action(detail=False, methods=["get"], url_path="appealable-checks")
    def appealable_checks(self, request):
        """Non-compliant results the resident can still appeal, with deadlines."""
        household = getattr(request.user, "household", None)
        if household is None:
            return Response([])
        results = []
        for check in appealable_checks(household):
            results.append({
                "id": check.id,
                "checked_on": timezone.localtime(check.checked_at).date().isoformat(),
                "waste_type": check.get_waste_type_display(),
                "weight_kg": float(check.weight_kg),
                "notes": check.notes,
                "appeal_deadline": appeal_deadline(check.greenpointsentry).isoformat(),
            })
        return Response(results)

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        """Staff: pick up an open complaint (open -> under_review)."""
        with transaction.atomic():
            complaint = get_object_or_404(Complaint.objects.select_for_update(of=("self",)), pk=pk)
            if complaint.status != "open":
                return _bad("Only open complaints can be moved to review.")
            complaint.status = "under_review"
            complaint.handled_by = request.user
            complaint.save()
        return Response(self.get_serializer(complaint).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        """
        Staff: close a complaint. Body: {"status": "resolved" | "rejected", "resolution_notes": "..."}
        For an APPEAL, "resolved" means the appeal is upheld: the check is
        overturned to compliant and the household's points are corrected.
        """
        new_status = request.data.get("status")
        notes = (request.data.get("resolution_notes") or "").strip()
        if new_status not in ("resolved", "rejected"):
            return _bad("status must be 'resolved' or 'rejected'.")
        if not notes:
            return _bad("Add a short explanation the resident can read.")
        if len(notes) > 300:
            return _bad("Explanation is too long (300 characters max).")

        with transaction.atomic():
            complaint = get_object_or_404(
                Complaint.objects.select_for_update(of=("self",)).select_related("compliance_check"),
                pk=pk,
            )
            if complaint.status not in ("open", "under_review"):
                return _bad(f"This complaint is already {complaint.status}.")

            if new_status == "resolved" and complaint.compliance_check_id:
                overturn_check(complaint.compliance_check)

            complaint.status = new_status
            complaint.resolution_notes = notes
            complaint.handled_by = request.user
            complaint.resolved_at = timezone.now()
            complaint.save()
        return Response(self.get_serializer(complaint).data)