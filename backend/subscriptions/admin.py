from django.contrib import admin
from .models import SubscriptionPlan, HouseholdSubscription, Payment

admin.site.register(SubscriptionPlan)
admin.site.register(HouseholdSubscription)
admin.site.register(Payment)