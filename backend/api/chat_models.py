from django.contrib.auth.models import User
from django.db import models


class ChatMessage(models.Model):
    """One saved message in a logged-in user's conversation with the assistant."""
    ROLE_CHOICES = [("user", "User"), ("assistant", "Assistant")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_messages")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["user", "id"])]

    def __str__(self):
        return f"{self.user} ({self.role}): {self.content[:40]}"