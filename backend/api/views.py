import os
from openai import OpenAI
from rest_framework import viewsets, permissions, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import Item
from .serializers import ItemSerializer, RegisterSerializer


@api_view(["GET"])
def health_check(request):
    """Hit this first to confirm frontend <-> backend wiring works."""
    return Response({"status": "ok", "message": "backend is alive"})


# NVIDIA NIM is OpenAI-compatible, so we reuse the `openai` client and just
# point it at NVIDIA's base_url. Get a free API key (no card) at build.nvidia.com.
_ai_client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY"),
)

# Pick any chat model from build.nvidia.com's catalog — this one is a solid,
# fast default. Swap the string if you want to try another.
AI_MODEL = "meta/llama-3.1-8b-instruct"


@api_view(["POST"])
@permission_classes([AllowAny])
def chat(request):
    """
    POST { "message": "..." } -> { "reply": "..." }
    Swap provider later: change base_url + api_key + model above to switch
    to Google Gemini, Groq, etc. without touching the rest of this view.
    """
    user_message = request.data.get("message", "")
    if not user_message.strip():
        return Response({"error": "message is required"}, status=400)

    try:
        completion = _ai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant for this hackathon app. Keep answers concise."},
                {"role": "user", "content": user_message},
            ],
            max_tokens=400,
        )
        reply = completion.choices[0].message.content
        return Response({"reply": reply})
    except Exception as e:
        return Response({"error": str(e)}, status=502)


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class ItemViewSet(viewsets.ModelViewSet):
    """
    Gives you GET/POST /api/items/ and GET/PUT/PATCH/DELETE /api/items/<id>/
    for free. Copy this pattern for every other model you add.
    """
    serializer_class = ItemSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Item.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)