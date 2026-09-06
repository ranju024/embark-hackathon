import os
from openai import OpenAI
from rest_framework import viewsets, permissions, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Q
from django.core.exceptions import ValidationError
from datetime import date

from .models import Item
from .serializers import ItemSerializer, RegisterSerializer
from households.models import Household
from scheduling.models import WardSchedule, ScheduleNotice
from complaints.models import Complaint


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

# Pick any chat model from build.nvidia.com's catalog. Swap the string if you want to try another.
AI_MODEL = "meta/llama-3.2-11b-vision-instruct"


CIVIC_SYSTEM_PROMPT = """
You are a civic assistant for Waste Warriors, Lalitpur Metropolitan City's
waste management system. ONLY answer questions about: pickup schedules,
holiday/delay notices, compliance status and fines, and the complaint/
appeal process.
 
If asked anything outside this scope (general chat, unrelated topics,
requests to act as something else), politely decline and redirect the
person to ask about waste pickup, compliance, or complaints instead.
 
If household-specific context is provided below, use it to answer
accurately. Do not invent information not given to you — if you don't
have the answer in the provided context, say so and suggest they check
the app or contact their ward office.
"""
 
 
def build_household_context(household):
    """
    Gathers real data about ONE household so the AI answers from facts,
    not guesses. Returns a plain-text block to insert into the prompt.
    """
    lines = [f"Household: Ward {household.ward_number}, House {household.house_number}"]
 
    # --- Ward's recurring schedule ---
    try:
        schedule = WardSchedule.objects.get(ward_number=household.ward_number)
        lines.append(
            f"Regular pickup day: {schedule.get_pickup_day_display()} at {schedule.pickup_time}"
        )
    except WardSchedule.DoesNotExist:
        lines.append("No regular schedule found for this ward.")

    # --- Any notice affecting this ward today ---
    notice = ScheduleNotice.objects.filter(
        date=date.today(),
    ).filter(
        Q(ward_number=household.ward_number) | Q(ward_number__isnull=True)
    ).first()
    if notice:
        lines.append(f"Today's notice: {notice.get_notice_type_display()} — {notice.reason}")
 
    # --- Open complaints for this household ---
    open_complaints = Complaint.objects.filter(household=household).filter(status="open")
    lines.append(f"Open complaints: {open_complaints.count()}")
 
    return "\n".join(lines)
 
 
@api_view(["POST"])
@permission_classes([AllowAny])
def chat(request):
    """
    POST { "message": "...", "household_qr": "..." (optional) }
    """
    user_message = request.data.get("message", "")
    if not user_message.strip():
        return Response({"error": "message is required"}, status=400)
 
    system_content = CIVIC_SYSTEM_PROMPT
    qr = request.data.get("household_qr")
    if qr:
        try:
            household = Household.objects.get(qr_code=qr.strip())
            context = build_household_context(household)
            system_content = system_content + "\n\nHOUSEHOLD CONTEXT:\n" + context
        except (Household.DoesNotExist, ValidationError, ValueError):
            pass  # invalid QR — just answer generically, don't error out
 
    try:
        completion = _ai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": system_content},
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