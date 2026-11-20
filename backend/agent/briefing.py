# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""Morning operations briefing.

Facts come from the same tools the agent uses. Gemini only rewrites them as prose; if its draft
contains any number that is not in the facts, the draft is rejected and a plain template is used.
"""

import json
import re
import uuid
from collections import Counter
from datetime import timedelta
from functools import lru_cache

from google.genai import types

from agent.loop import MODEL, audit, client
from agent.tools import get_forecast, get_nationality_surge
from database import LOCATIONS, TODAY
from forecast import HORIZON_DAYS
from nationality import profiles

PROMPT = """Write a morning operations briefing (under 220 words) for a transit operations manager.
Use exactly three sections: "Top 3 unusual", "Today's visitor mix", "Recommended actions".
Use only numbers that appear in the FACTS, copied exactly (you may add thousands separators).
Do not add any other numbers, estimates or percentages. Say once that the data is synthetic.

FACTS:
"""

_NUMBER = re.compile(r"\d+(?:\.\d+)?")
_cached: dict | None = None

# Surges are grouped by region so one line covers e.g. all Western visitors on a day.
# Services None = use that country's own preferred_services (single-country regions).
REGIONS = {
    "Domestic": (["IN"], None),
    "Western": (["US", "UK", "AU", "DE", "FR"], "English-speaking staff, card terminals, prepaid taxi info"),
    "East Asian": (["CN", "KR", "JP"], "multilingual signage, mobile payment, group bus capacity"),
    "Gulf": (["AE"], None),
    "Southeast Asian": (["SG"], None),
    "Other": (["OTHER"], None),
}
REGION_OF = {nat: region for region, (nats, _) in REGIONS.items() for nat in nats}


def group_surges(surge_list: list[dict]) -> list[dict]:
    """One entry per (day, region), covering every location where that region surges."""
    groups: dict[tuple, list[dict]] = {}
    for s in surge_list:
        groups.setdefault((s["date"], REGION_OF[s["nationality"]]), []).append(s)

    out = []
    for (day, region), members in groups.items():
        nats, services = REGIONS[region]
        countries = list(dict.fromkeys(m["name"] for m in sorted(members, key=lambda m: -m["expected_riders"])))
        locations = list(dict.fromkeys(m["location_name"] for m in members))
        low, high = min(m["ratio"] for m in members), max(m["ratio"] for m in members)
        expected = sum(m["expected_riders"] for m in members)
        extra = expected - sum(m["usual_riders"] for m in members)
        holiday = ", ".join(dict.fromkeys(m["holiday"] for m in members))
        services = services or profiles().loc[nats[0], "preferred_services"]
        ratio = f"{low}x" if low == high else f"{low}-{high}x"
        who = f"{region} visitors" + (f" ({', '.join(countries)})" if len(nats) > 1 else "")
        where = ("all locations" if len(locations) == len(LOCATIONS)
                 else " and ".join([", ".join(locations[:-1]), locations[-1]]) if len(locations) > 1
                 else locations[0])
        out.append({
            "date": day, "weekday": members[0]["weekday"], "region": region, "countries": countries,
            "locations": locations, "ratio_min": low, "ratio_max": high,
            "expected_riders": expected, "extra_riders": extra, "holiday": holiday,
            "recommendation": (f"{members[0]['weekday']} {day}, {where}: {who} {ratio} normal, "
                               f"about {expected:,} riders ({holiday}). Recommend: {services}."),
        })
    return sorted(out, key=lambda g: (g["date"], -g["extra_riders"]))


@lru_cache(maxsize=1)
def build_facts() -> dict:
    days = [TODAY + timedelta(days=i) for i in range(HORIZON_DAYS)]
    forecasts = [get_forecast(loc, d.isoformat()) for loc in LOCATIONS for d in days]

    unusual = sorted(forecasts, key=lambda f: abs(f["change_vs_last_week_pct"]), reverse=True)[:3]

    riders = Counter()
    for f in forecasts:
        if f["date"] == TODAY.isoformat():
            riders.update(f["expected_riders_by_nationality"])
    total = sum(riders.values())
    names = profiles()["name"]

    grouped = group_surges(get_nationality_surge(TODAY.isoformat(), HORIZON_DAYS)["surges"])

    return {
        "date": TODAY.isoformat(),
        "weekday": TODAY.strftime("%A"),
        "unusual": [
            {k: f[k] for k in ("location_name", "date", "weekday", "total_riders",
                               "same_day_last_week_actual", "change_vs_last_week_pct", "holidays_today")}
            for f in unusual
        ],
        "today_total_riders": total,
        "today_mix_pct": {names[n]: round(v / total * 100, 1) for n, v in riders.most_common()},
        "surges": [{k: v for k, v in g.items() if k != "recommendation"} for g in grouped],
        "recommendations": [g["recommendation"] for g in grouped],
    }


def ungrounded_numbers(text: str, facts: dict) -> list[str]:
    allowed = set(_NUMBER.findall(json.dumps(facts))) | {"1", "2", "3"}  # 1-3 for section numbering
    return [n for n in _NUMBER.findall(text.replace(",", "")) if n not in allowed]


def template(facts: dict) -> str:
    lines = [f"TransitPulse morning briefing: {facts['weekday']} {facts['date']} (synthetic data)", "",
             "Top 3 unusual"]
    for i, u in enumerate(facts["unusual"], 1):
        hol = ", ".join(dict.fromkeys(u["holidays_today"].values())) or "no public holiday"
        lines.append(f"{i}. {u['location_name']}, {u['weekday']} {u['date']}: {u['total_riders']:,} riders "
                     f"forecast, {u['change_vs_last_week_pct']:+.1f}% vs same day last week ({hol}).")
    mix = ", ".join(f"{k} {v}%" for k, v in list(facts["today_mix_pct"].items())[:5])
    lines += ["", f"Today's visitor mix ({facts['today_total_riders']:,} riders, all locations): {mix}.",
              "", "Recommended actions"]
    lines += [f"- {r}" for r in facts["recommendations"]] or ["- No nationality surges in the next 7 days."]
    return "\n".join(lines)


def get_briefing() -> dict:
    global _cached
    if _cached:
        return _cached
    facts = build_facts()
    text, source, note = template(facts), "template", None
    try:
        draft = client().models.generate_content(
            model=MODEL, contents=PROMPT + json.dumps(facts, indent=1),
            config=types.GenerateContentConfig(temperature=0.2),
        ).text or ""
        bad = ungrounded_numbers(draft, facts)
        if bad:
            note = f"Gemini draft used numbers not in the facts ({', '.join(bad[:5])}); template used instead."
        else:
            text, source = draft, "gemini"
    except Exception as e:  # missing key, network or API error: the template still works
        note = f"Gemini unavailable ({e}); template used instead."
    audit(uuid.uuid4().hex[:12], "briefing", source=source, note=note)
    result = {"date": facts["date"], "source": source, "note": note, "text": text, "facts": facts}
    if source == "gemini":
        _cached = result
    return result
