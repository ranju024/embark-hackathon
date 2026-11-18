from django.core.management.base import BaseCommand
from rewards.models import PartnerOffer


class Command(BaseCommand):
    help = "Seeds example partner offers for local/demo testing. Brand colours are approximate placeholders."

    def handle(self, *args, **options):
        offers = [
            {"partner_name": "Foodmandu", "title": "Rs. 200 off your next order", "description": "Valid on orders above Rs. 1000.", "points_cost": 80, "brand_color": "#E8312A"},
            {"partner_name": "Pathao", "title": "Free ride up to Rs. 150", "description": "One-time redemption, Kathmandu Valley rides only.", "points_cost": 60, "brand_color": "#E3262E"},
            {"partner_name": "Yango", "title": "20% off your next ride", "description": "Valid for 30 days after redemption.", "points_cost": 50, "brand_color": "#111111"},
            {"partner_name": "Daraz", "title": "Rs. 300 voucher", "description": "Minimum order value Rs. 1500.", "points_cost": 120, "brand_color": "#F85606"},
        ]
        for data in offers:
            offer, created = PartnerOffer.objects.update_or_create(
                partner_name=data["partner_name"], title=data["title"], defaults=data
            )
            self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'}: {offer}"))