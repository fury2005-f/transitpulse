# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""
Generates synthetic hourly ridership for transport hubs in Bangalore, India,
broken down by visitor nationality.

Outputs (backend/data/):
  ridership.csv             timestamp, location, nationality, riders
  weather.csv               timestamp, temperature_c, rain_mm
  holidays.csv              date, country, holiday_name
  nationality_profiles.csv  one row per nationality (shares, multipliers, seasonality, services)
"""

import csv
import json
import math
import os
import random
from datetime import date, datetime, timedelta

import holidays
import httpx
import numpy as np

START_DATE = date(2024, 1, 1)
END_DATE = date(2025, 12, 31)
LAT, LON = 12.97, 77.59  # Bangalore (Bengaluru), Karnataka
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DOMESTIC = "IN"

# nationality -> visitor profile. holiday_code is the ISO code the `holidays` package uses.
# seasonal = 12 monthly weights (Jan..Dec), ~1.0 on average.
PROFILES = {
    "IN": dict(name="India (domestic)", holiday_code="IN", base_share=70.0, holiday_multiplier=1.4,
               seasonal=[1.0, 0.9, 0.9, 1.1, 1.2, 0.9, 0.8, 0.9, 1.0, 1.2, 1.2, 1.1],
               services="UPI payments, metro card top-up, Kannada/Hindi signage"),
    "US": dict(name="United States", holiday_code="US", base_share=7.0, holiday_multiplier=1.6,
               seasonal=[1.2, 1.2, 1.1, 0.9, 0.8, 0.7, 0.8, 0.8, 0.9, 1.1, 1.2, 1.3],
               services="English-speaking staff, card terminals, prepaid taxi info"),
    "UK": dict(name="United Kingdom", holiday_code="GB", base_share=4.0, holiday_multiplier=1.6,
               seasonal=[1.3, 1.3, 1.1, 0.9, 0.7, 0.7, 0.8, 0.8, 0.9, 1.1, 1.2, 1.2],
               services="English-speaking staff, card terminals, heritage tour info"),
    "AE": dict(name="UAE / Gulf", holiday_code="AE", base_share=3.0, holiday_multiplier=2.5,
               seasonal=[0.8, 0.8, 0.9, 1.0, 1.0, 1.4, 1.5, 1.4, 1.0, 0.8, 0.7, 0.7],
               services="Arabic signage, halal food info, family taxi bookings"),
    "SG": dict(name="Singapore", holiday_code="SG", base_share=2.0, holiday_multiplier=1.8,
               seasonal=[1.0, 1.1, 1.0, 1.0, 0.9, 1.1, 1.0, 0.9, 0.9, 1.0, 1.0, 1.2],
               services="card/mobile payment, airport shuttle info, business district maps"),
    "DE": dict(name="Germany", holiday_code="DE", base_share=2.0, holiday_multiplier=1.6,
               seasonal=[1.2, 1.2, 1.1, 1.0, 0.8, 0.7, 0.8, 0.8, 0.9, 1.1, 1.2, 1.2],
               services="card terminals, English signage, tech park shuttle info"),
    "AU": dict(name="Australia", holiday_code="AU", base_share=2.0, holiday_multiplier=1.8,
               seasonal=[1.3, 1.1, 0.9, 1.0, 0.9, 0.9, 1.0, 0.9, 0.9, 1.0, 1.0, 1.3],
               services="English-speaking staff, card terminals, cricket match transport"),
    "JP": dict(name="Japan", holiday_code="JP", base_share=2.0, holiday_multiplier=2.0,
               seasonal=[1.1, 0.9, 1.0, 0.9, 1.3, 0.8, 0.8, 1.2, 0.9, 1.0, 1.0, 1.1],
               services="Japanese signage, card terminals, business district maps"),
    "CN": dict(name="China", holiday_code="CN", base_share=1.5, holiday_multiplier=2.5,
               seasonal=[1.0, 1.4, 1.0, 1.0, 0.9, 0.8, 0.9, 0.9, 0.9, 1.4, 0.9, 0.9],
               services="Mandarin signage, mobile payment, group bus capacity"),
    "FR": dict(name="France", holiday_code="FR", base_share=1.0, holiday_multiplier=1.6,
               seasonal=[1.2, 1.2, 1.1, 0.9, 0.8, 0.7, 1.0, 1.0, 0.8, 1.0, 1.1, 1.2],
               services="card terminals, cultural tour info, multilingual maps"),
    "KR": dict(name="South Korea", holiday_code="KR", base_share=1.0, holiday_multiplier=2.0,
               seasonal=[1.1, 1.0, 0.9, 1.0, 1.0, 0.8, 0.9, 1.0, 1.3, 1.1, 1.0, 0.9],
               services="Korean signage, card terminals, business district maps"),
    "OTHER": dict(name="Other", holiday_code=None, base_share=4.5, holiday_multiplier=1.0,
                  seasonal=[1.0] * 12, services="multilingual maps, English-speaking staff"),
}

# Per-location knobs.
#   domestic_bias:     how much more Indian-heavy than the base mix (daily commuters)
#   tourism_weight:    how strongly international holiday surges raise total volume
#   domestic_holiday:  total-volume effect of an Indian public holiday
LOCATIONS = {
    "station_a":    dict(name="Station A",    base=900, weekend_factor=0.6,  domestic_bias=2.5, tourism_weight=0.2, domestic_holiday=0.7),
    "station_b":    dict(name="Station B",    base=550, weekend_factor=0.7,  domestic_bias=2.0, tourism_weight=0.3, domestic_holiday=0.75),
    "tourist_hub":  dict(name="Tourist Hub",  base=350, weekend_factor=1.8,  domestic_bias=0.5, tourism_weight=1.0, domestic_holiday=1.8),
    "bus_terminal": dict(name="Bus Terminal", base=500, weekend_factor=0.8,  domestic_bias=1.2, tourism_weight=0.5, domestic_holiday=1.3),
}


def fetch_weather() -> dict[str, tuple[float, float]]:
    """Hourly temp/rain from Open-Meteo archive. Returns {} on any failure."""
    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={LAT}&longitude={LON}"
        f"&start_date={START_DATE}&end_date={END_DATE}"
        "&hourly=temperature_2m,rain&timezone=Asia%2FKolkata"
    )
    try:
        resp = httpx.get(url, timeout=30)
        resp.raise_for_status()
        h = resp.json()["hourly"]
        return {
            t: (temp, rain or 0.0)
            for t, temp, rain in zip(h["time"], h["temperature_2m"], h["rain"])
            if temp is not None
        }
    except Exception as e:
        print(f"Open-Meteo unavailable ({e}), using synthetic weather.")
        return {}


def synthetic_weather(ts: datetime) -> tuple[float, float]:
    """Fallback Bangalore climate: mild year-round, hottest in April, monsoon rain Jun-Oct."""
    day = ts.timetuple().tm_yday
    temp = 24 + 3 * math.sin((day - 15) / 365 * 2 * math.pi)
    temp += 5 * math.sin((ts.hour - 9) / 24 * 2 * math.pi) + random.gauss(0, 1.5)
    rain_chance = 0.35 if 6 <= ts.month <= 10 else 0.05
    rain = max(0.0, random.gauss(1.5, 2.0)) if random.random() < rain_chance else 0.0
    return round(temp, 1), round(rain, 1)


def hour_shape(hour: int) -> float:
    """Double-peaked commute pattern: morning rush ~9, evening rush ~19, small midday bump."""
    morning = math.exp(-0.5 * ((hour - 9) / 1.5) ** 2)
    evening = math.exp(-0.5 * ((hour - 19) / 2.0) ** 2)
    midday = 0.3 * math.exp(-0.5 * ((hour - 14) / 2.5) ** 2)
    return 0.1 + morning + evening + midday


def load_holidays() -> tuple[dict[date, set[str]], list[tuple]]:
    """Returns ({date: {nationalities on holiday}}, rows for holidays.csv)."""
    years = range(START_DATE.year, END_DATE.year + 1)
    active: dict[date, set[str]] = {}
    rows = []
    for nat, p in PROFILES.items():
        if not p["holiday_code"]:
            continue
        cal = holidays.country_holidays(p["holiday_code"], years=years, language="en_US")
        for d, name in sorted(cal.items()):
            active.setdefault(d, set()).add(nat)
            rows.append((d.isoformat(), nat, name))
    return active, rows


def daily_mix(d: date, on_holiday: set[str], loc: dict) -> tuple[np.ndarray, float]:
    """Nationality share vector for one location/day, plus the international demand factor."""
    m = d.month - 1
    weights, foreign_now, foreign_base = [], 0.0, 0.0
    for nat, p in PROFILES.items():
        w = p["base_share"] * p["seasonal"][m]
        if nat in on_holiday:
            w *= p["holiday_multiplier"]
        if nat == DOMESTIC:
            w *= loc["domestic_bias"]
        else:
            foreign_now += w
            foreign_base += p["base_share"]
        weights.append(w)
    weights = np.array(weights)
    # >1 when foreign visitors are above normal (their holidays / peak season)
    foreign_index = foreign_now / foreign_base
    demand = 1 + loc["tourism_weight"] * (foreign_index - 1)
    return weights / weights.sum(), demand


def generate():
    os.makedirs(DATA_DIR, exist_ok=True)
    random.seed(42)
    rng = np.random.default_rng(42)
    nats = list(PROFILES)

    holiday_map, holiday_rows = load_holidays()
    weather_api = fetch_weather()

    weather_rows, ridership_rows = [], []
    d = START_DATE
    while d <= END_DATE:
        on_holiday = holiday_map.get(d, set())
        is_weekend = d.weekday() >= 5
        month_factor = 1.0 + 0.1 * math.sin((d.month - 1) / 12 * 2 * math.pi)
        mixes = {lid: daily_mix(d, on_holiday, loc) for lid, loc in LOCATIONS.items()}

        for hour in range(24):
            ts = datetime(d.year, d.month, d.day, hour)
            iso = ts.strftime("%Y-%m-%dT%H:00")
            temp, rain = weather_api.get(iso) or synthetic_weather(ts)
            weather_rows.append((iso, temp, rain))

            # heavy monsoon rain keeps people home; extreme heat (>38C) dampens travel
            weather_factor = (0.7 if rain > 5 else 0.85 if rain > 0.5 else 1.0) * \
                             (0.85 if temp > 38 else 1.0)

            for lid, loc in LOCATIONS.items():
                mix, demand = mixes[lid]
                total = loc["base"] * hour_shape(hour) * month_factor * demand * weather_factor
                if is_weekend:
                    total *= loc["weekend_factor"]
                if DOMESTIC in on_holiday:
                    total *= loc["domestic_holiday"]
                total = max(0, int(round(total * (1 + rng.normal(0, 0.08)))))

                # split the hourly total across nationalities (integer counts that sum to total)
                for nat, n in zip(nats, rng.multinomial(total, mix)):
                    ridership_rows.append((iso, lid, nat, int(n)))
        d += timedelta(days=1)

    def write(name, header, rows):
        path = os.path.join(DATA_DIR, name)
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)
        print(f"{len(rows):>9,} rows -> {path}")

    write("ridership.csv", ["timestamp", "location", "nationality", "riders"], ridership_rows)
    write("weather.csv", ["timestamp", "temperature_c", "rain_mm"], weather_rows)
    write("holidays.csv", ["date", "country", "holiday_name"], holiday_rows)
    write("nationality_profiles.csv",
          ["nationality", "name", "base_share", "holiday_multiplier", "seasonal_pattern", "preferred_services"],
          [(n, p["name"], p["base_share"], p["holiday_multiplier"], json.dumps(p["seasonal"]), p["services"])
           for n, p in PROFILES.items()])


def self_check():
    """Gulf share at the Tourist Hub must jump on a UAE holiday in peak summer vs an ordinary day."""
    hub = LOCATIONS["tourist_hub"]
    ae = list(PROFILES).index("AE")
    normal, _ = daily_mix(date(2024, 11, 12), set(), hub)
    surge, demand = daily_mix(date(2024, 6, 16), {"AE"}, hub)
    assert surge[ae] > 2 * normal[ae], (surge[ae], normal[ae])
    assert demand > 1.0, demand
    assert abs(sum(p["base_share"] for p in PROFILES.values()) - 100) < 1e-9
    print(f"Self-check OK: Tourist Hub Gulf share {normal[ae]:.1%} (Nov) -> {surge[ae]:.1%} (Eid, June), "
          f"volume x{demand:.2f}")


if __name__ == "__main__":
    self_check()
    generate()
