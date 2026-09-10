"""
Business logic for computing a household's Green Points standing.
"""
from django.db.models import Sum

# (points_required_to_reach_this_tier, tier_name)
# Tune these as real usage data comes in — nothing else depends on the
# exact numbers, only on BADGE_TIERS staying sorted ascending by threshold.
BADGE_TIERS = [
    (0, "Bronze"),
    (50, "Silver"),
    (150, "Gold"),
    (300, "Eco Champion"),
]


def get_total_points(household):
    """Sum of every GreenPointsEntry ever recorded for this household."""
    total = household.points_entries.aggregate(total=Sum("points"))["total"]
    return total or 0


def get_badge_info(household):
    """
    Returns everything the frontend needs to render a badge + progress bar:

    {
        "total_points": 87,
        "tier": "Silver",
        "next_tier": "Gold",           # None if already at the top tier
        "points_to_next_tier": 63,     # None if already at the top tier
        "progress_percent": 37,        # 0-100, progress within the current tier band
    }
    """
    total_points = get_total_points(household)

    current_tier = BADGE_TIERS[0][1]
    current_threshold = BADGE_TIERS[0][0]
    next_tier = None
    next_threshold = None

    for i, (threshold, tier_name) in enumerate(BADGE_TIERS):
        if total_points >= threshold:
            current_tier = tier_name
            current_threshold = threshold
            if i + 1 < len(BADGE_TIERS):
                next_threshold, next_tier = BADGE_TIERS[i + 1]
            else:
                next_threshold, next_tier = None, None
        else:
            break

    if next_threshold is None:
        progress_percent = 100
        points_to_next_tier = None
    else:
        band_size = next_threshold - current_threshold
        progress_in_band = total_points - current_threshold
        progress_percent = int(min(100, max(0, (progress_in_band / band_size) * 100)))
        points_to_next_tier = next_threshold - total_points

    return {
        "total_points": total_points,
        "tier": current_tier,
        "next_tier": next_tier,
        "points_to_next_tier": points_to_next_tier,
        "progress_percent": progress_percent,
    }