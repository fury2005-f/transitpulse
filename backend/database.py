# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""SQLite schema, shared constants and read queries for ops.db."""

import os
import sqlite3
from contextlib import closing
from datetime import date
from functools import lru_cache

import pandas as pd

DB_PATH = os.path.join(os.path.dirname(__file__), "ops.db")

# Demo clock: the data is historical, so the app pretends "today" is this date.
# Rows before it are history; from it onwards everything must be forecast.
TODAY = date.fromisoformat(os.getenv("TRANSITPULSE_TODAY", "2025-12-22"))

LOCATIONS = {
    "station_a": "Station A",
    "station_b": "Station B",
    "tourist_hub": "Tourist Hub",
    "bus_terminal": "Bus Terminal",
}

SCHEMA = """
DROP TABLE IF EXISTS ridership;
DROP TABLE IF EXISTS weather;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS nationality_profiles;
DROP TABLE IF EXISTS capacity_limits;

CREATE TABLE ridership (
    timestamp   TEXT    NOT NULL,              -- local hour, 'YYYY-MM-DDTHH:00'
    location    TEXT    NOT NULL,
    nationality TEXT    NOT NULL,
    riders      INTEGER NOT NULL CHECK (riders >= 0),
    PRIMARY KEY (location, timestamp, nationality)
) WITHOUT ROWID;

CREATE TABLE weather (
    timestamp     TEXT PRIMARY KEY,
    temperature_c REAL NOT NULL,
    rain_mm       REAL NOT NULL
);

CREATE TABLE holidays (
    date         TEXT NOT NULL,                -- 'YYYY-MM-DD'
    country      TEXT NOT NULL,                -- nationality code, e.g. 'CN'
    holiday_name TEXT NOT NULL,
    PRIMARY KEY (date, country)
);

CREATE TABLE nationality_profiles (
    nationality        TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    base_share         REAL NOT NULL,          -- % of visitors on a normal day
    holiday_multiplier REAL NOT NULL,
    seasonal_pattern   TEXT NOT NULL,          -- JSON list of 12 monthly weights
    preferred_services TEXT NOT NULL
);

CREATE TABLE capacity_limits (
    location       TEXT PRIMARY KEY,
    daily_capacity INTEGER NOT NULL CHECK (daily_capacity > 0)   -- max riders per day
);
INSERT INTO capacity_limits VALUES
    ('station_a', 12000), ('station_b', 8000), ('tourist_hub', 15000), ('bus_terminal', 9000);
"""


def connect() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH)


def read_sql(sql: str, params=(), **kwargs) -> pd.DataFrame:
    with closing(connect()) as conn:
        return pd.read_sql(sql, conn, params=params, **kwargs)


def hourly_totals() -> pd.DataFrame:
    """Total riders per location-hour (all nationalities summed), with that hour's weather."""
    return read_sql(
        """
        SELECT r.location, r.timestamp, SUM(r.riders) AS riders,
               w.temperature_c, w.rain_mm
        FROM ridership r JOIN weather w USING (timestamp)
        GROUP BY r.location, r.timestamp
        ORDER BY r.location, r.timestamp
        """,
        parse_dates=["timestamp"],
    )


@lru_cache(maxsize=1)
def capacity_limits() -> dict[str, int]:
    df = read_sql("SELECT location, daily_capacity FROM capacity_limits")
    return {loc: int(cap) for loc, cap in df.itertuples(index=False)}


def holiday_dates() -> pd.DataFrame:
    return read_sql("SELECT date, country FROM holidays", parse_dates=["date"])


def actuals(location: str, start: date, end: date) -> pd.DataFrame:
    """Raw hourly rows (timestamp, nationality, riders) for one location, start..end inclusive."""
    return read_sql(
        """
        SELECT timestamp, nationality, riders FROM ridership
        WHERE location = ? AND timestamp >= ? AND timestamp < date(?, '+1 day')
        ORDER BY timestamp
        """,
        (location, start.isoformat(), end.isoformat()),
    )
