# ALL DATA IS SYNTHETIC â€” this is a method demonstration.
"""Cross-segment demand cascade: transport forecast â†’ downstream group businesses.

Each downstream segment has a conversion rate from station ridership that varies by
nationality mix (tour groups visit the park; commuters go to work) and a capacity.
"""

from datetime import date, timedelta
from functools import lru_cache

from database import LOCATIONS, TODAY, capacity_limits
from forecast import HORIZON_DAYS, forecast_hours
from nationality import expected_mix

# Downstream segments derived from transport ridership.
# rate_by_nat: what fraction of riders from each nationality flows into this segment.
# A domestic commuter rarely visits the park; a Chinese tour group almost always does.
SEGMENTS = {
    "loop_bus": {
        "name": "Loop Bus",
        "capacity": 9000,
        "unit": "riders",
        "rate_by_nat": {
            "IN": 0.15, "US": 0.55, "UK": 0.55, "AE": 0.50, "SG": 0.45,
            "DE": 0.50, "AU": 0.55, "JP": 0.60, "CN": 0.65, "FR": 0.55,
            "KR": 0.60, "OTHER": 0.40,
        },
        "default_rate": 0.30,
    },
    "theme_park": {
        "name": "Theme Park",
        "capacity": 4500,
        "unit": "entries",
        "rate_by_nat": {
            "IN": 0.05, "US": 0.30, "UK": 0.25, "AE": 0.35, "SG": 0.30,
            "DE": 0.25, "AU": 0.30, "JP": 0.40, "CN": 0.45, "FR": 0.25,
            "KR": 0.40, "OTHER": 0.20,
        },
        "default_rate": 0.15,
    },
    "ropeway": {
        "name": "Ropeway",
        "capacity": 2600,
        "unit": "riders",
        "rate_by_nat": {
            "IN": 0.03, "US": 0.20, "UK": 0.20, "AE": 0.15, "SG": 0.18,
            "DE": 0.20, "AU": 0.22, "JP": 0.25, "CN": 0.30, "FR": 0.20,
            "KR": 0.25, "OTHER": 0.12,
        },
        "default_rate": 0.08,
    },
    "hotel": {
        "name": "Hotel",
        "capacity": 1300,
        "unit": "check-ins",
        "rate_by_nat": {
            "IN": 0.01, "US": 0.12, "UK": 0.12, "AE": 0.15, "SG": 0.10,
            "DE": 0.12, "AU": 0.14, "JP": 0.08, "CN": 0.10, "FR": 0.12,
            "KR": 0.08, "OTHER": 0.06,
        },
        "default_rate": 0.03,
    },
    "retail": {
        "name": "Retail & F&B",
        "capacity": 7000,
        "unit": "transactions",
        "rate_by_nat": {
            "IN": 0.10, "US": 0.40, "UK": 0.35, "AE": 0.50, "SG": 0.40,
            "DE": 0.35, "AU": 0.40, "JP": 0.45, "CN": 0.55, "FR": 0.35,
            "KR": 0.45, "OTHER": 0.25,
        },
        "default_rate": 0.20,
    },
}


def cascade_for_day(day: date) -> dict:
    """Compute the downstream cascade for one day, summing across all transport locations."""
    total_riders = 0
    weighted_mix: dict[str, float] = {}

    for loc in LOCATIONS:
        hours = forecast_hours(loc, day)
        loc_total = float(hours["forecast"].sum())
        total_riders += loc_total
        mix = expected_mix(loc, day)
        for nat, share in mix.items():
            weighted_mix[nat] = weighted_mix.get(nat, 0.0) + share * loc_total

    # normalise to get the blended nationality mix across all stations
    if total_riders > 0:
        blended = {nat: count / total_riders for nat, count in weighted_mix.items()}
    else:
        blended = weighted_mix

    segments = []
    for seg_id, seg in SEGMENTS.items():
        # weighted conversion: sum of (nationality share * that nationality's conversion rate)
        rate = sum(blended.get(nat, 0) * seg["rate_by_nat"].get(nat, seg["default_rate"])
                   for nat in blended)
        volume = int(round(total_riders * rate))
        cap_pct = round(volume / seg["capacity"] * 100, 1)
        segments.append({
            "id": seg_id,
            "name": seg["name"],
            "volume": volume,
            "unit": seg["unit"],
            "capacity": seg["capacity"],
            "capacity_pct": cap_pct,
        })

    return {
        "date": day.isoformat(),
        "weekday": day.strftime("%A"),
        "transport_total": int(round(total_riders)),
        "transport_capacity": sum(capacity_limits().values()),
        "segments": segments,
    }


def cascade_week() -> list[dict]:
    """Cascade for the full forecast horizon."""
    return [cascade_for_day(TODAY + timedelta(days=i)) for i in range(HORIZON_DAYS)]
