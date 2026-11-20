# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""Builds the model input table: one row per location-hour, total riders as the target."""

import pandas as pd

from database import holiday_dates, hourly_totals

BASE_FEATURES = [
    "location", "hour", "dayofweek", "month", "is_weekend",
    "temperature_c", "rain_mm", "lag_168", "lag_336",
]


def feature_columns(df: pd.DataFrame) -> list[str]:
    return BASE_FEATURES + [c for c in df.columns if c.startswith("hol_")]


def build_features() -> pd.DataFrame:
    df = hourly_totals()

    # lags below shift by row count, so every location must be an unbroken hourly series
    steps = df.groupby("location")["timestamp"].diff().dropna()
    assert (steps == pd.Timedelta(hours=1)).all(), "ridership has missing or duplicate hours"

    ts = df["timestamp"]
    df["hour"] = ts.dt.hour
    df["dayofweek"] = ts.dt.dayofweek
    df["month"] = ts.dt.month
    df["is_weekend"] = (df["dayofweek"] >= 5).astype(int)

    # one 0/1 column per country: hol_IN, hol_CN, ...
    hol = holiday_dates()
    flags = pd.crosstab(hol["date"], hol["country"]).clip(upper=1).add_prefix("hol_")
    df["date"] = ts.dt.normalize()
    df = df.merge(flags, left_on="date", right_index=True, how="left")
    hol_cols = list(flags.columns)
    df[hol_cols] = df[hol_cols].fillna(0).astype(int)

    # same hour 1 and 2 weeks earlier — both already known when forecasting up to 7 days ahead
    by_loc = df.groupby("location")["riders"]
    df["lag_168"] = by_loc.shift(168)
    df["lag_336"] = by_loc.shift(336)

    df["location"] = df["location"].astype("category")
    return df.dropna(subset=["lag_336"]).reset_index(drop=True)
