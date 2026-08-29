from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from django.db.models import Sum
from .models import GreenPointsEntry
from .serializers import GreenPointsEntrySerializer
from households.models import Household


class GreenPointsEntryViewSet(viewsets.ReadOnlyModelViewSet):
    # NOTE: ReadOnlyModelViewSet is given, not a blank — this only allows
    # GET (list/retrieve), no create/update/delete via the API at all,
    # since entries are signal-generated only.
    queryset = GreenPointsEntry.objects.all()
    serializer_class = GreenPointsEntrySerializer


class WardLeaderboardViewSet(ViewSet):
    """
    GET /api/ward-leaderboard/
    Returns each ward's total points, highest first: for the ward officer dashboard.
    """

    def list(self, request):
        totals = (
            Household.objects.values("ward_number")
            .annotate(total_points=Sum("points_entries__points"))
            .order_by("-total_points")
        )
        return Response(list(totals))
    