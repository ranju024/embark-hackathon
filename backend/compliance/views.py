from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from .models import ComplianceCheck
from .serializers import ComplianceCheckSerializer


class ComplianceCheckViewSet(viewsets.ModelViewSet):
    queryset = ComplianceCheck.objects.all()
    serializer_class = ComplianceCheckSerializer
    parser_classes = [MultiPartParser, FormParser]
    # NOTE: photo uploads need multipart form parsing, not the default JSON parser. 

    def get_permissions(self):
        """
        Only staff (collectors/officers) can submit or modify compliance checks
        """
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def get_queryset(self):
        queryset = ComplianceCheck.objects.all()
        qr = self.request.query_params.get("household_qr")
        status_param = self.request.query_params.get("status")
        if qr:
            queryset = queryset.filter(household__qr_code=qr)
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset
    
    @action(detail=True, methods=["patch"], permission_classes=[permissions.IsAdminUser], parser_classes=[JSONParser])
    def review(self, request, pk=None):
        """
        PATCH /api/compliance-checks/<id>/review/
        Body: {"status": "compliant" or "non_compliant", "notes": "..." (optional)}
        A ward officer's final confirmation/override — separate from the
        collector's original submission, same reasoning as Complaint.resolve.
        """        
        check = self.get_object()
        new_status = request.data.get("status")
        if new_status not in ["compliant", "non_compliant"]:
            return Response({"error": "status must be 'compliant' or 'non_compliant'"}, status=400)
        
        check.status = new_status
        if "notes" in request.data:
            check.notes = request.data["notes"]
        check.save()
        
        serializer = self.get_serializer(check)
        return Response(serializer.data)
        