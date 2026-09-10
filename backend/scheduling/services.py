"""
Figures out a household's next pickup, accounting for one-off
ScheduleNotice exceptions (holidays / delays) on top of the recurring
WardSchedule.
"""
from datetime import date, timedelta
from .models import WardSchedule, ScheduleNotice


def get_next_pickup(household):
    """
    Returns:
    {
        "date": date(2026, 9, 16),
        "time": time(8, 0),
        "is_delayed": False,
        "reason": "",
    }
    or None if the household's ward has no WardSchedule configured yet.

    Looks up to 4 weeks ahead so a run of consecutive holiday notices
    doesn't leave the household with no pickup shown at all.
    """
    try:
        ward_schedule = WardSchedule.objects.get(ward_number=household.ward_number)
    except WardSchedule.DoesNotExist:
        return None

    today = date.today()

    for weeks_ahead in range(4):
        days_until = (ward_schedule.pickup_day - today.weekday()) % 7
        candidate_date = today + timedelta(days=days_until + 7 * weeks_ahead)

        # A ward-specific notice takes priority over an all-wards notice.
        notice = ScheduleNotice.objects.filter(
            date=candidate_date, ward_number=household.ward_number
        ).first()
        if notice is None:
            notice = ScheduleNotice.objects.filter(
                date=candidate_date, ward_number__isnull=True
            ).first()

        if notice and notice.notice_type == "holiday":
            continue  # skip this occurrence, check the following week

        if notice and notice.notice_type == "delay" and notice.delayed_to_time:
            return {
                "date": candidate_date,
                "time": notice.delayed_to_time,
                "is_delayed": True,
                "reason": notice.reason,
            }

        return {
            "date": candidate_date,
            "time": ward_schedule.pickup_time,
            "is_delayed": False,
            "reason": "",
        }

    return None  # 4 straight holiday weeks shouldn't happen, but don't crash