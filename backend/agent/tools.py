# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""The four tools the agent can call. Gemini reads each function's type hints and docstring
as the tool description, so the docstrings are written for the model."""

import datetime as dt

from agent.guardrails import run_safe_query
from database import LOCATIONS, TODAY, actuals, capacity_limits
from forecast import HORIZON_DAYS, forecast_hours
from nationality import SURGE_MIN_EXTRA, SURGE_RATIO, expected_mix, holidays_by_date, surges, to_pct

LAST_FORECAST_DAY = TODAY + dt.timedelta(days=HORIZON_DAYS - 1)


def _location(location: str) -> str:
    key = location.strip().lower().replace(" ", "_")
    if key not in LOCATIONS:
        raise ValueError(f"Unknown location '{location}'. Use one of: {', '.join(LOCATIONS)}.")
    return key


def _day(value: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value.strip())
    except ValueError:
        raise ValueError(f"Bad date '{value}'. Use YYYY-MM-DD.") from None


def get_forecast(location: str, date: str) -> dict:
    """Forecast riders for one location on one day: daily total, how much of the daily capacity it
    uses, peak hour, hourly riders, comparison with the same day last week, the expected nationality
    mix and any public holidays.

    Args:
        location: station_a, station_b, tourist_hub or bus_terminal.
        date: YYYY-MM-DD, from today up to 6 days ahead.
    """
    loc, day = _location(location), _day(date)
    hours = forecast_hours(loc, day)
    total, last_week = float(hours["forecast"].sum()), float(hours["last_week"].sum())
    peak = hours.loc[hours["forecast"].idxmax()]
    mix = expected_mix(loc, day)
    return {
        "location": loc,
        "location_name": LOCATIONS[loc],
        "date": day.isoformat(),
        "weekday": day.strftime("%A"),
        "total_riders": int(round(total)),
        "daily_capacity": capacity_limits()[loc],
        "capacity_used_pct": round(total / capacity_limits()[loc] * 100, 1),
        "same_day_last_week_actual": int(round(last_week)),
        "change_vs_last_week_pct": round((total / last_week - 1) * 100, 1),
        "peak_hour": peak["timestamp"].strftime("%H:00"),
        "peak_riders": int(round(peak["forecast"])),
        "hourly_riders": {t.strftime("%H"): int(round(f)) for t, f in zip(hours["timestamp"], hours["forecast"])},
        "nationality_mix_pct": to_pct(mix),
        "expected_riders_by_nationality": {
            k: int(round(v * total)) for k, v in mix.sort_values(ascending=False).items()
        },
        "holidays_today": holidays_by_date().get(day, {}),
    }


def get_actuals(location: str, start: str, end: str) -> dict:
    """Actual past riders for one location between two dates (inclusive, at most 31 days, all
    before today): daily totals, each day's peak hour, and the nationality mix over the period.

    Args:
        location: station_a, station_b, tourist_hub or bus_terminal.
        start: first day, YYYY-MM-DD.
        end: last day, YYYY-MM-DD, must be before today.
    """
    loc, s, e = _location(location), _day(start), _day(end)
    if e >= TODAY:
        raise ValueError(f"end must be before today ({TODAY}). Use get_forecast for today onwards.")
    if s > e or (e - s).days > 30:
        raise ValueError("start must be on or before end, and the range at most 31 days.")
    df = actuals(loc, s, e)
    if df.empty:
        raise ValueError(f"No data for {loc} between {s} and {e}.")
    hourly = df.groupby("timestamp")["riders"].sum()
    daily = [
        {
            "date": d,
            "weekday": dt.date.fromisoformat(d).strftime("%A"),
            "total_riders": int(h.sum()),
            "peak_hour": h.idxmax()[11:16],
            "peak_riders": int(h.max()),
        }
        for d, h in hourly.groupby(hourly.index.str[:10])
    ]
    by_nat = df.groupby("nationality")["riders"].sum()
    return {
        "location": loc,
        "location_name": LOCATIONS[loc],
        "start": s.isoformat(),
        "end": e.isoformat(),
        "total_riders": int(by_nat.sum()),
        "daily": daily,
        "nationality_mix_pct": to_pct(by_nat / by_nat.sum()),
    }


def run_sql(query: str) -> dict:
    """Run one read-only SQLite SELECT and return up to 200 rows. Only data before today is visible.
    Use it for questions the other tools cannot answer.

    Tables:
      ridership(timestamp TEXT 'YYYY-MM-DDTHH:00', location TEXT, nationality TEXT, riders INTEGER)
        one row per hour, location and nationality
      weather(timestamp TEXT 'YYYY-MM-DDTHH:00', temperature_c REAL, rain_mm REAL)
      holidays(date TEXT 'YYYY-MM-DD', country TEXT, holiday_name TEXT)
      nationality_profiles(nationality TEXT, name TEXT, base_share REAL, holiday_multiplier REAL,
                           seasonal_pattern TEXT, preferred_services TEXT)
      capacity_limits(location TEXT, daily_capacity INTEGER)   max riders per day
    Locations: station_a, station_b, tourist_hub, bus_terminal.
    Nationality / country codes: IN, US, UK, AE, SG, DE, AU, JP, CN, FR, KR, OTHER.

    Args:
        query: a single SELECT statement (WITH ... SELECT allowed). No comments, no semicolons inside.
    """
    return run_safe_query(query)


def get_nationality_surge(date: str, days_ahead: int = 7) -> dict:
    """Find nationalities whose riders are expected to jump because their country has a public
    holiday. A surge means at least 1.5x the riders of a normal day and at least 20 extra riders that
    day at that location. Each surge has the holiday, expected share and riders, and the services
    that nationality uses most.

    Args:
        date: first day to scan, YYYY-MM-DD, today or later.
        days_ahead: how many days to scan, 1 to 7 (capped at the forecast horizon).
    """
    start = _day(date)
    if not TODAY <= start <= LAST_FORECAST_DAY:
        raise ValueError(f"date must be between {TODAY} and {LAST_FORECAST_DAY}.")
    n = max(1, min(int(days_ahead), (LAST_FORECAST_DAY - start).days + 1))
    found = surges(start, n)
    return {
        "from": start.isoformat(),
        "to": (start + dt.timedelta(days=n - 1)).isoformat(),
        "rule": f"riders >= {SURGE_RATIO}x a normal day and >= {SURGE_MIN_EXTRA} extra riders",
        "surge_count": len(found),
        "surges": found,
    }


TOOLS = [get_forecast, get_actuals, run_sql, get_nationality_surge]
_BY_NAME = {f.__name__: f for f in TOOLS}


def call_tool(name: str, args: dict) -> dict:
    """Run a tool by name. Errors are returned (not raised) so the model can correct itself."""
    fn = _BY_NAME.get(name)
    if fn is None:
        return {"error": f"Unknown tool '{name}'."}
    try:
        return fn(**args)
    except (ValueError, TypeError) as e:
        return {"error": str(e)}
