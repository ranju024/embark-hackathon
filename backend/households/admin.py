from django.contrib import admin
from .models import Household

# Register your models here.
@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    readonly_fields = ("qr_code",)