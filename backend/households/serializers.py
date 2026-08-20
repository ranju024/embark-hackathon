from rest_framework import serializers
from .models import Household
from phonenumber_field.serializerfields import PhoneNumberField


class HouseholdSerializer(serializers.ModelSerializer): 
    phone_number = PhoneNumberField()
    class Meta:
        model = Household
        fields = ['ward_number', 'house_number', 'owner_name', 'phone_number', 'qr_code', 'created_at', 'updated_at']
        read_only_fields = ['qr_code', 'created_at', 'updated_at']
