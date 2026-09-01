from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Complaint
from .serializers import ComplaintSerializer


class ComplaintViewSet(viewsets.ModelViewSet):
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        # Support ?status=open and ?household_qr=<uuid> filters, combined —
        # a ward officer might want "all open complaints", a resident might
        # want "my complaints", or both together.
        queryset = Complaint.objects.all()
        status_param = self.request.query_params.get("status")
        qr = self.request.query_params.get("household_qr")
        if status_param:
            queryset = queryset.filter(status=status_param)
        if qr:
            queryset = queryset.filter(household__qr_code=qr)
        return queryset

    @action(detail=True, methods=["patch"])
    def resolve(self, request, pk=None):
        """
        PATCH /api/complaints/<id>/resolve/
        Body: {"status": "resolved" or "rejected", "resolution_notes": "..."}
        A dedicated endpoint for a ward officer to close out a complaint —
        separate from the general update, so it's a clear, auditable action.
        """
        complaint = self.get_object()
        # TODO: same helper you used in ComplianceCheckViewSet.qr_image —
        # fetches the object matching this URL's pk

        new_status = request.data.get("status")
        if new_status not in ["resolved", "rejected"]:
            return Response({"error": "status must be 'resolved' or 'rejected'"}, status=400)

        complaint.status = new_status
        complaint.resolution_notes = request.data.get("resolution_notes", "")
        complaint.save()

        serializer = self.get_serializer(complaint)
        return Response(serializer.data)