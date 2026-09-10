from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404

from .models import GreenPointsEntry, PartnerOffer, Redemption
from .serializers import GreenPointsEntrySerializer, PartnerOfferSerializer, RedemptionSerializer
from .services import get_total_points
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


class PartnerOfferViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/partner-offers/ — active offers, visible to any logged-in resident."""
    queryset = PartnerOffer.objects.filter(is_active=True)
    serializer_class = PartnerOfferSerializer
    permission_classes = [permissions.IsAuthenticated]


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def my_redemptions(request):
    household = getattr(request.user, "household", None)
    if household is None:
        return Response([])
    redemptions = household.redemptions.order_by("-redeemed_at")
    return Response(RedemptionSerializer(redemptions, many=True).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def redeem_offer(request):
    """
    POST { "offer_id": 1 }
    Locks the household row for the duration of the transaction so two
    concurrent redemption requests can't both pass the balance check
    before either deduction lands (no accidental overspend).
    """
    household = getattr(request.user, "household", None)
    if household is None:
        return Response({"detail": "Register a household before redeeming offers."}, status=status.HTTP_400_BAD_REQUEST)

    offer = get_object_or_404(PartnerOffer, id=request.data.get("offer_id"), is_active=True)

    with transaction.atomic():
        locked_household = Household.objects.select_for_update().get(id=household.id)
        current_balance = get_total_points(locked_household)

        if current_balance < offer.points_cost:
            return Response(
                {"detail": f"Not enough GreenPoints. You have {current_balance}, this offer costs {offer.points_cost}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        redemption = Redemption.objects.create(
            household=locked_household,
            offer=offer,
            points_spent=offer.points_cost,
        )
        GreenPointsEntry.objects.create(
            household=locked_household,
            redemption=redemption,
            points=-offer.points_cost,
        )

    return Response(RedemptionSerializer(redemption).data, status=status.HTTP_201_CREATED)