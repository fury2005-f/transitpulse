# TransitPulse

Demand forecasting and AI-powered operations briefings for tourism-heavy transit networks.

⚠ All data is synthetic — this is a method demonstration.

## What it does

- **Forecast**: hourly ridership for 4 locations, 7 days ahead (LightGBM, 8.1% MAPE vs 12.7% naive baseline).
- **Who is coming**: expected nationality mix per day, and alerts when a country's holiday drives a surge.
- **Morning briefing**: Gemini writes it; any number not found in the source data gets the draft rejected.
- **Group impact**: carries the transport forecast through to the group's other businesses (loop bus, theme park, ropeway, hotel, retail). Each business's share depends on who is visiting, so a tourist-heavy day with fewer arrivals can still fill the hotel. Conversion rates and capacities are hand-set assumptions (`backend/cascade.py`).
- **AI chat** with read-only, guarded SQL, plus a **data explorer** to check any number.

## Run locally

```
cd backend   && .venv\Scripts\python -m uvicorn main:app --port 8000
cd frontend  && npm run dev        # http://localhost:3001
cd backend   && .venv\Scripts\python -m pytest
```

Interview notes: `docs/interview-prep.md`.
