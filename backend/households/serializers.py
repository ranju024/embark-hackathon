from rest_framework import serializers
from phonenumber_field.serializerfields import PhoneNumberField
from .models import Household


class HouseholdSerializer(serializers.ModelSerializer): 
    phone_number = PhoneNumberField()
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    class Meta:
        model = Household
        fields = ['id', 'owner_username', 'ward_number', 'house_number', 'owner_name', 
                  'phone_number', 'qr_code', 'created_at', 'updated_at']
        read_only_fields = ['qr_code', 'created_at', 'updated_at']
    
    def validate(self, data):
        """
        Object-level check: reject a SECOND registration attempt with a
        clean error message, before it ever reaches the database
        """       
        request = self.context["request"]
        if Household.objects.filter(owner=request.user).exists():
            raise serializers.ValidationError("You have already registered a household.")
        return data
    
    def create(self, validated_data):
        request = self.context["request"]
        validated_data["owner"] = request.user
        return super().create(validated_data)