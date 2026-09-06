import uuid
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from phonenumber_field.modelfields import PhoneNumberField


class Household(models.Model):
    """
    A registered household in a specific ward with a unique qr
    """
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name="household")
    ward_number = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(29)])
    house_number = models.CharField(max_length=15)
    owner_name = models.CharField(max_length=50)
    phone_number = PhoneNumberField(region="NP")

    # QR identity 
    qr_code = models.UUIDField(
        default=uuid.uuid4, 
        editable=False,
        unique=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("ward_number", "house_number")

    def __str__(self):
        return f"House Number {self.house_number} from Ward {self.ward_number}"