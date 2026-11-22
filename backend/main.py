# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""TransitPulse API.  Run from backend/:  .venv\\Scripts\\python -m uvicorn main:app --reload"""

import os
from datetime import date, timedelta
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.genai import errors as genai_errors
from pydantic import BaseModel, Field

from agent import briefing, loop
from database import LOCATIONS, TODAY, actuals, capacity_limits
from forecast import HORIZON_DAYS, forecast_hours
from nationality import expected_mix, holidays_by_date, to_pct

Location = Literal["station_a", "station_b", "tourist_hub", "bus_terminal"]

app = FastAPI(title="TransitPulse API", description="All data is synthetic — this is a method demonstration.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(ValueError)
async def bad_request(_: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/api/forecast")
def forecast(location: Location, days: int = Query(HORIZON_DAYS, ge=1, le=HORIZON_DAYS)):
    """Hourly forecast from today, plus each day's expected nationality mix (the mix is daily)."""
    hours = forecast_hours(location, TODAY, days)
    capacity = capacity_limits()[location]
    daily = []
    for i in range(days):
        d = TODAY + timedelta(days=i)
        total = float(hours.loc[hours["timestamp"].dt.date == d, "forecast"].sum())
        daily.append({
            "date": d.isoformat(),
            "weekday": d.strftime("%A"),
            "total_riders": int(round(total)),
            "capacity_used_pct": round(total / capacity * 100, 1),
            "nationality_mix_pct": to_pct(expected_mix(location, d)),
            "holidays": holidays_by_date().get(d, {}),
        })
    return {
        "location": location,
        "location_name": LOCATIONS[location],
        "today": TODAY.isoformat(),
        "daily_capacity": capacity,
        "hourly": [{"timestamp": t.strftime("%Y-%m-%dT%H:00"), "forecast": round(float(f), 1)}
                   for t, f in zip(hours["timestamp"], hours["forecast"])],
        "daily": daily,
    }


@app.get("/api/actuals")
def get_actuals(location: Location, start: date, end: date):
    """Recorded riders. Not limited to before today, so the dashboard can show forecast vs actual."""
    if end < start or (end - start).days > 61:
        raise HTTPException(400, "end must be on or after start, and the range at most 62 days.")
    df = actuals(location, start, end)
    hourly = df.groupby("timestamp")["riders"].sum()
    by_day = df.assign(date=df["timestamp"].str[:10]).groupby(["date", "nationality"])["riders"].sum()
    return {
        "location": location,
        "location_name": LOCATIONS[location],
        "hourly": [{"timestamp": t, "riders": int(r)} for t, r in hourly.items()],
        "daily": [
            {"date": d, "total_riders": int(g.sum()), "nationality_mix_pct": to_pct(g.droplevel(0) / g.sum())}
            for d, g in by_day.groupby(level=0)
        ],
    }


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


@app.post("/api/chat")
def chat(req: ChatRequest):
    try:
        return loop.ask(req.question)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except genai_errors.APIError as e:
        raise HTTPException(502, f"Gemini API error: {e}")
    except httpx.TimeoutException:
        raise HTTPException(504, "Gemini did not respond in time. Its servers are busy; try again in a minute.")


@app.get("/api/briefing")
def get_briefing():
    return briefing.get_briefing()


EXPLORABLE_TABLES = {
    "ridership": {"label": "Ridership", "desc": "Hourly rider counts by location and nationality", "limit": 200},
    "weather": {"label": "Weather", "desc": "Hourly temperature and rainfall", "limit": 200},
    "holidays": {"label": "Holidays", "desc": "Public holidays by country", "limit": 500},
    "nationality_profiles": {"label": "Nationality Profiles", "desc": "Visitor nationality profiles and service preferences", "limit": 50},
    "capacity_limits": {"label": "Capacity Limits", "desc": "Daily capacity per location", "limit": 10},
}


@app.get("/api/data/tables")
def data_tables():
    from database import connect
    from contextlib import closing
    tables = []
    with closing(connect()) as conn:
        cur = conn.cursor()
        for name, meta in EXPLORABLE_TABLES.items():
            cur.execute(f"SELECT COUNT(*) FROM {name}")
            count = cur.fetchone()[0]
            tables.append({"id": name, **meta, "row_count": count})
    return {"tables": tables, "today": TODAY.isoformat()}


DATE_COLUMNS = {"ridership": "timestamp", "weather": "timestamp", "holidays": "date"}


@app.get("/api/data/{table}")
def data_rows(
    table: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    if table not in EXPLORABLE_TABLES:
        raise HTTPException(404, f"Unknown table: {table}")
    from database import connect
    from contextlib import closing

    date_col = DATE_COLUMNS.get(table)
    where = ""
    params: list = []
    if date_col and (date_from or date_to):
        clauses = []
        if date_from:
            clauses.append(f"{date_col} >= ?")
            params.append(date_from)
        if date_to:
            clauses.append(f"{date_col} < date(?, '+1 day')")
            params.append(date_to)
        where = " WHERE " + " AND ".join(clauses)

    with closing(connect()) as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM {table}{where} LIMIT ? OFFSET ?", params + [limit, offset])
        columns = [d[0] for d in cur.description]
        rows = [list(r) for r in cur.fetchall()]
        cur.execute(f"SELECT COUNT(*) FROM {table}{where}", params)
        total = cur.fetchone()[0]
    return {"table": table, "columns": columns, "rows": rows, "total": total, "offset": offset, "limit": limit}

