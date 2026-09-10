from django.core.management.base import BaseCommand
from subscriptions.models import SubscriptionPlan


class Command(BaseCommand):
    help = "Seeds two example subscription plans for local/sandbox testing."

    def handle(self, *args, **options):
        plans = [
            {
                "name": "Convenience Plan", "slug": "convenience",
                "description": "Collectors segregate your waste for you, plus priority pickup slots.",
                "monthly_price_npr": 500, "assisted_segregation": True, "priority_pickup": True,
            },
            {
                "name": "Waste Warrior Pro", "slug": "pro",
                "description": "Everything in Convenience, plus compost pickup, bulk-waste credits, and a monthly compliance report.",
                "monthly_price_npr": 900, "assisted_segregation": True, "priority_pickup": True,
                "compost_addon": True, "bulk_pickup_credits_per_month": 2, "monthly_compliance_report": True,
            },
        ]
        for data in plans:
            plan, created = SubscriptionPlan.objects.update_or_create(slug=data["slug"], defaults=data)
            self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'}: {plan}"))