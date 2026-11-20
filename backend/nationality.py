# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""Nationality mix forecasting and holiday-driven surge detection.

Expected mix for a day = the location's normal mix for that month (learned from past days with no
holiday anywhere) x each country's holiday multiplier if it is on holiday that day, re-normalised.
"""

from datetime import date, timedelta
from functools import lru_cache

import pandas as pd

from database import LOCATIONS, TODAY, read_sql
from forecast import forecast_hours

SURGE_RATIO = 1.5      # at least 1.5x the riders of a normal day...
SURGE_MIN_EXTRA = 20   # ...and at least 20 extra riders, so tiny groups don't trigger alerts


@lru_cache(maxsize=1)
def profiles() -> pd.DataFrame:
    return read_sql("SELECT * FROM nationality_profiles").set_index("nationality")


@lru_cache(maxsize=1)
def normal_mix() -> pd.Series:
    """Share of each nationality per (location, month), from past days with no holiday in any country."""
    df = read_sql(
        """
        SELECT location, CAST(substr(timestamp, 6, 2) AS INTEGER) AS month, nationality,
               SUM(riders) AS riders
        FROM ridership
        WHERE timestamp < ? AND substr(timestamp, 1, 10) NOT IN (SELECT date FROM holidays)
        GROUP BY location, month, nationality
        """,
        (TODAY.isoformat(),),
    )
    riders = df.set_index(["location", "month", "nationality"])["riders"]
    return riders / riders.groupby(level=["location", "month"]).transform("sum")


@lru_cache(maxsize=1)
def holidays_by_date() -> dict[date, dict[str, str]]:
    out: dict[date, dict[str, str]] = {}
    for d, country, name in read_sql("SELECT date, country, holiday_name FROM holidays").itertuples(index=False):
        out.setdefault(date.fromisoformat(d), {})[country] = name
    return out


def expected_mix(location: str, day: date) -> pd.Series:
    """Expected share (0-1) of each nationality at a location on a day."""
    base = normal_mix().loc[(location, day.month)]
    on_holiday = holidays_by_date().get(day, {})
    mult = profiles()["holiday_multiplier"].reindex(base.index).where(base.index.isin(list(on_holiday)), 1.0)
    weights = base * mult
    return weights / weights.sum()


def to_pct(shares: pd.Series) -> dict[str, float]:
    return {k: round(float(v) * 100, 1) for k, v in shares.sort_values(ascending=False).items()}


def surges(start: date, days: int) -> list[dict]:
    """Nationalities whose riders jump because their own country is on holiday, per day and location."""
    found = []
    for i in range(days):
        day = start + timedelta(days=i)
        on_holiday = holidays_by_date().get(day, {})
        if not on_holiday:
            continue
        for loc, loc_name in LOCATIONS.items():
            hours = forecast_hours(loc, day)
            total, last_week = hours["forecast"].sum(), hours["last_week"].sum()
            mix, normal = expected_mix(loc, day), normal_mix().loc[(loc, day.month)]
            for nat, holiday in on_holiday.items():
                expected = mix[nat] * total
                usual = normal[nat] * last_week  # this nationality's riders on the same day last week
                if expected < SURGE_RATIO * usual or expected - usual < SURGE_MIN_EXTRA:
                    continue
                p = profiles().loc[nat]
                found.append({
                    "date": day.isoformat(), "weekday": day.strftime("%A"),
                    "location": loc, "location_name": loc_name,
                    "nationality": nat, "name": p["name"], "holiday": holiday,
                    "expected_share_pct": round(mix[nat] * 100, 1),
                    "normal_share_pct": round(normal[nat] * 100, 1),
                    "expected_riders": int(round(expected)), "usual_riders": int(round(usual)),
                    "ratio": round(expected / usual, 1),
                    "recommendation": (
                        f"{loc_name}, {day:%A %d %b}: expect about {int(round(expected))} {p['name']} riders "
                        f"({expected / usual:.1f}x a normal day, {holiday}). "
                        f"Recommend: {p['preferred_services']}."
                    ),
                })
    return sorted(found, key=lambda s: (s["date"], s["usual_riders"] - s["expected_riders"]))
