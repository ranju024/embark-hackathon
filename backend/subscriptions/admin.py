from django.contrib import admin
from .models import (
    SubscriptionPlan, HouseholdSubscription, Payment,
    HouseholdServicePreference, BulkPickupRequest,
)

admin.site.register(SubscriptionPlan)
admin.site.register(HouseholdSubscription)
admin.site.register(Payment)
admin.site.register(HouseholdServicePreference)
admin.site.register(BulkPickupRequest)