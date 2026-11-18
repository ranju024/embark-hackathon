import logging
import os
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from openai import OpenAI
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from complaints.models import Complaint
from compliance.models import ComplianceCheck
from rewards.services import get_badge_info
from scheduling.models import CollectorRoute, ScheduleNotice, WardSchedule
from scheduling.services import get_next_pickup
from subscriptions.models import BulkPickupRequest
from subscriptions.services import get_active_subscription

from .chat_models import ChatMessage
from .prompts import build_system_prompt
from .throttles import ChatRateThrottle

logger = logging.getLogger(__name__)

# Any OpenAI-compatible provider works: set these in backend/.env.
_ai_client = OpenAI(
    base_url=os.getenv("AI_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.getenv("AI_API_KEY") or os.getenv("NVIDIA_API_KEY"),
    timeout=30,  # never let a slow provider hang the request
)
AI_MODEL = os.getenv("AI_MODEL")

MAX_MESSAGE_CHARS = 1000
MAX_HISTORY_MESSAGES = 6      # how many recent messages the model sees
HISTORY_RETURNED = 50         # how many the chat page loads
KEEP_PER_USER = 200           # older messages are deleted
GREET_AFTER = timedelta(hours=6)
WARD_COUNT = 29


def build_household_context(household):
    """Real data about ONE household so the assistant answers from facts, not guesses."""
    lines = [f"Household: Ward {household.ward_number}, House {household.house_number}"]

    try:
        schedule = WardSchedule.objects.get(ward_number=household.ward_number)
        lines.append(f"Regular pickup day: {schedule.get_pickup_day_display()} at {schedule.pickup_time:%I:%M %p}")
    except WardSchedule.DoesNotExist:
        lines.append("No regular schedule found for this ward.")

    next_pickup = get_next_pickup(household)
    if next_pickup:
        text = f"Next pickup: {next_pickup['date']:%A, %b %d} at {next_pickup['time']:%I:%M %p}"
        if next_pickup["is_delayed"]:
            text += f" (delayed{': ' + next_pickup['reason'] if next_pickup['reason'] else ''})"
        lines.append(text)

    notice = ScheduleNotice.objects.filter(date=timezone.localdate()).filter(
        Q(ward_number=household.ward_number) | Q(ward_number__isnull=True)
    ).first()
    if notice:
        lines.append(f"Today's notice: {notice.get_notice_type_display()} — {notice.reason}")

    badge = get_badge_info(household)
    points_line = f"GreenPoints: {badge['total_points']} (tier: {badge['tier']}"
    if badge["next_tier"]:
        points_line += f", {badge['points_to_next_tier']} points to {badge['next_tier']}"
    lines.append(points_line + ")")

    subscription = get_active_subscription(household)
    if subscription:
        lines.append(f"Subscription: {subscription.plan.name}, active until {subscription.period_end:%b %d, %Y}")
    else:
        lines.append("Subscription: free basic collection only")

    open_complaints = Complaint.objects.filter(household=household, status__in=["open", "under_review"])
    lines.append(f"Open complaints: {open_complaints.count()}")

    return "\n".join(lines)


def build_staff_context(user):
    """A short work summary for staff. Counts only: no resident details."""
    today = timezone.localdate()

    pending = ComplianceCheck.objects.filter(status="pending_review").count()
    open_complaints = Complaint.objects.filter(status="open").count()
    in_review = Complaint.objects.filter(status="under_review").count()
    routes_today = CollectorRoute.objects.filter(date=today).count()
    bulk_soon = BulkPickupRequest.objects.filter(
        status="scheduled", pickup_date__range=(today, today + timedelta(days=1))
    ).count()

    my_routes = [
        f"Ward {r.ward_number} ({r.get_status_display().lower()})"
        for r in CollectorRoute.objects.filter(collector=user, date=today).order_by("ward_number")
    ]

    scheduled = set(WardSchedule.objects.values_list("ward_number", flat=True))
    missing = [ward for ward in range(1, WARD_COUNT + 1) if ward not in scheduled]

    lines = [
        f"Waste checks waiting for review: {pending}",
        f"Complaints: {open_complaints} open, {in_review} under review",
        f"Your routes today: {', '.join(my_routes) if my_routes else 'none assigned'}",
        f"Routes assigned today across all wards: {routes_today}",
        f"Bulk pickups scheduled for today or tomorrow: {bulk_soon}",
    ]
    if missing:
        shown = ", ".join(str(w) for w in missing[:12]) + (" and more" if len(missing) > 12 else "")
        lines.append(f"Wards with no pickup schedule yet ({len(missing)}): {shown}")
    else:
        lines.append("Every ward has a pickup schedule.")
    return "\n".join(lines)


def clean_history(raw_history):
    """For guests: accept the client's recent messages but trust nothing about them."""
    if not isinstance(raw_history, list):
        return []
    cleaned = []
    for item in raw_history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            cleaned.append({"role": role, "content": content[:MAX_MESSAGE_CHARS]})
    return cleaned


def _history_response(request):
    if not request.user.is_authenticated:
        return Response({"messages": []})
    rows = list(ChatMessage.objects.filter(user=request.user).order_by("-id")[:HISTORY_RETURNED])
    rows.reverse()
    return Response({
        "messages": [
            {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at}
            for m in rows
        ]
    })


def _clear_history(request):
    if request.user.is_authenticated:
        ChatMessage.objects.filter(user=request.user).delete()
    return Response(status=204)


def _answer(request):
    user_message = request.data.get("message", "")
    if not isinstance(user_message, str) or not user_message.strip():
        return Response({"error": "message is required"}, status=400)
    user_message = user_message.strip()[:MAX_MESSAGE_CHARS]

    user = request.user if request.user.is_authenticated else None
    is_staff = bool(user and user.is_staff)

    if user is not None:
        # Logged in: the server's saved conversation is the source of truth.
        recent = list(ChatMessage.objects.filter(user=user).order_by("-id")[:MAX_HISTORY_MESSAGES])
        history = [{"role": m.role, "content": m.content[:MAX_MESSAGE_CHARS]} for m in reversed(recent)]
        last_at = recent[0].created_at if recent else None
        is_first = last_at is None or timezone.now() - last_at > GREET_AFTER
    else:
        history = clean_history(request.data.get("history"))
        is_first = not history

    household = None
    first_name = None
    if is_staff:
        first_name = (user.first_name or "").strip() or user.username
    elif user is not None:
        household = getattr(user, "household", None)
        if household is not None and household.owner_name.strip():
            first_name = household.owner_name.split()[0]

    system_content = build_system_prompt(
        role="staff" if is_staff else "resident",
        first_name=first_name,
        is_first_message=is_first,
        today_text=f"{timezone.localdate():%A, %B %d, %Y}",
        is_admin=bool(user and user.is_superuser),
    )
    if is_staff:
        system_content += "\nWORK SUMMARY:\n" + build_staff_context(user)
    elif household is not None:
        system_content += "\nHOUSEHOLD INFORMATION:\n" + build_household_context(household)

    messages = [{"role": "system", "content": system_content}]
    messages += history
    messages.append({"role": "user", "content": user_message})

    try:
        completion = _ai_client.chat.completions.create(model=AI_MODEL, messages=messages, max_tokens=500)
        reply = (completion.choices[0].message.content or "").strip()
    except Exception:
        logger.exception("AI chat request failed")
        return Response({"error": "The assistant is unavailable right now. Please try again shortly."}, status=502)

    if not reply:
        # Reasoning models can burn the whole token budget thinking and return nothing.
        logger.warning("AI model returned an empty reply (model=%s)", AI_MODEL)
        return Response({"error": "The assistant didn't produce an answer. Please try rephrasing."}, status=502)

    if user is not None:
        with transaction.atomic():
            ChatMessage.objects.create(user=user, role="user", content=user_message)
            ChatMessage.objects.create(user=user, role="assistant", content=reply)
            stale = list(
                ChatMessage.objects.filter(user=user).order_by("-id").values_list("id", flat=True)[KEEP_PER_USER:]
            )
            if stale:
                ChatMessage.objects.filter(id__in=stale).delete()

    return Response({"reply": reply})


@api_view(["GET", "POST", "DELETE"])
@permission_classes([AllowAny])
@throttle_classes([ChatRateThrottle])
def chat(request):
    """
    GET    /api/chat/  -> the logged-in user's saved conversation
    POST   /api/chat/  -> send a message, get a reply (saved for logged-in users)
    DELETE /api/chat/  -> clear the saved conversation
    The role (resident or staff) always comes from the account, never from the request.
    """
    if request.method == "GET":
        return _history_response(request)
    if request.method == "DELETE":
        return _clear_history(request)
    return _answer(request)