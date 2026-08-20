import qrcode
import io
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Household
from .serializers import HouseholdSerializer


class HouseholdViewSet(viewsets.ModelViewSet):  
    queryset = Household.objects.all()
    serializer_class = HouseholdSerializer

    def get_queryset(self):
        queryset = Household.objects.all()
        ward = self.request.query_params.get("ward")

        if ward:
            queryset = queryset.filter(ward_number=ward)
        return queryset

    @action(detail=True, methods=["get"])
    def qr_image(self, request, pk=None):
        """
        Returns a PNG image of this household's QR code.
        The QR should encode the qr_code UUID (not the db pk).
        """
        household = self.get_object()
        qr = qrcode.make(str(household.qr_code)) 
        buffer = io.BytesIO()
        qr.save(buffer, format="PNG")
        buffer.seek(0)

        return HttpResponse(buffer, content_type="image/png")