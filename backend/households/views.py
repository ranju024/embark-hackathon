import qrcode
import io
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Household
from .serializers import HouseholdSerializer


class HouseholdViewSet(viewsets.ModelViewSet):  
    serializer_class = HouseholdSerializer

    def get_queryset(self):
        """
        Staff (ward officers/admins) see every household.
        A regular resident sees only their own. So, an anonymous
        or non-owning user's list request naturally comes back empty,
        without needing separate permission logic.
        """
        if not self.request.user.is_authenticated:
            return Household.objects.none()
        if self.request.user.is_staff:
            return Household.objects.all()
        return Household.objects.filter(owner=self.request.user)

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
    
    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mine(self, request):
        """
        GET /api/households/mine/
        Returns the CURRENT user's own household, regardless of whether
        they're staff or not
        """
        try:
            household = Household.objects.get(owner=request.user)
        except Household.DoesNotExist:
            return Response({"detail": "No household registered."}, status=404)
        serializer = self.get_serializer(household)
        return Response(serializer.data)