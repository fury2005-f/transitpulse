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
