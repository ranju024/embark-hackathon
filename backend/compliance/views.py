from rest_framework import viewsets, permissions
from rest_framework.parsers import MultiPartParser, FormParser
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
        if qr:
            queryset = queryset.filter(household__qr_code=qr)
        return queryset