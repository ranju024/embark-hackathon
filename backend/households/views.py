import io

import qrcode
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .lookup import build_household_overview
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
        The QR encodes the qr_code UUID (not the db pk).
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

    @action(detail=False, methods=["get"], permission_classes=[IsAdminUser])
    def lookup(self, request):
        """
        GET /api/households/lookup/?ward=5&house=12   or   ?qr=<uuid>
        Staff only. Finds one household and returns an overview of it.
        """
        qr = (request.query_params.get("qr") or "").strip()
        ward = (request.query_params.get("ward") or "").strip()
        house = (request.query_params.get("house") or "").strip()

        if qr:
            try:
                household = Household.objects.get(qr_code=qr)
            except (Household.DoesNotExist, DjangoValidationError):
                return Response({"detail": "No household found for that QR code."}, status=404)
        elif ward and house:
            if not ward.isdigit():
                return Response({"detail": "Ward must be a number."}, status=400)
            try:
                household = Household.objects.get(ward_number=int(ward), house_number__iexact=house)
            except Household.DoesNotExist:
                return Response({"detail": f"No household found for Ward {ward}, House {house}."}, status=404)
        else:
            return Response({"detail": "Enter a ward and house number, or scan a QR code."}, status=400)

        return Response(build_household_overview(household))