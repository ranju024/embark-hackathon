from rest_framework import viewsets
from rest_framework.response import Response
from django.db.models import Sum

from .models import GreenPointsEntry
from .serializers import GreenPointsEntrySerializer
from households.models import Household


class GreenPointsEntryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GreenPointsEntrySerializer
    def get_queryset(self):
        """
        Staffs see every points entry. A resident sees only entries
        belonging to THEIR OWN household
        """       
        if not self.request.user.is_authenticated:
            return GreenPointsEntry.objects.none()
        if self.request.user.is_staff:
            return GreenPointsEntry.objects.all()
        
        return GreenPointsEntry.objects.filter(household__owner=self.request.user)


class WardLeaderboardViewSet(viewsets.ViewSet):
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
    