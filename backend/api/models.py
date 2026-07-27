from django.db import models
from django.contrib.auth.models import User


class Item(models.Model):
    """
    Rename/extend this to whatever your hackathon idea actually needs
    (e.g. Post, Product, Task, Event). It's here so the team has a
    working model -> serializer -> view -> url chain to copy immediately.
    """
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="items")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
