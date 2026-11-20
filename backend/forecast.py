# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""LightGBM model for total riders per location-hour.
Run directly to train on all data before TODAY and save model.txt for the API."""

import os
from datetime import date, timedelta
from functools import lru_cache

import lightgbm as lgb
import numpy as np
import pandas as pd

from database import TODAY
from features import build_features, feature_columns

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.txt")
HORIZON_DAYS = 7  # lag_168 (same hour last week) is only known for targets up to 7 days ahead


# ponytail: uses the actual weather of the target hour (a "perfect weather forecast").
# A live deployment would feed in a weather forecast instead, which adds some error.
def train(df: pd.DataFrame) -> lgb.LGBMRegressor:
    model = lgb.LGBMRegressor(
        n_estimators=600, learning_rate=0.05, num_leaves=63, random_state=42, verbose=-1,
    )
    model.fit(df[feature_columns(df)], df["riders"])
    return model


def predict(model: lgb.LGBMRegressor, df: pd.DataFrame) -> np.ndarray:
    return model.predict(df[feature_columns(df)]).clip(min=0)


@lru_cache(maxsize=1)
def _features() -> pd.DataFrame:
    return build_features()


@lru_cache(maxsize=1)
def _booster() -> lgb.Booster:
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError("model.txt not found. Run: python forecast.py")
    return lgb.Booster(model_file=MODEL_PATH)


def forecast_hours(location: str, start: date, days: int = 1) -> pd.DataFrame:
    """Hourly forecast for [start, start + days).
    Columns: timestamp, forecast, last_week (actual riders at the same hour 7 days earlier)."""
    last = TODAY + timedelta(days=HORIZON_DAYS - 1)
    if start < TODAY or start + timedelta(days=days - 1) > last:
        raise ValueError(f"Forecasts are available from {TODAY} to {last} only.")
    df = _features()
    rows = df[(df["location"] == location)
              & (df["timestamp"] >= pd.Timestamp(start))
              & (df["timestamp"] < pd.Timestamp(start + timedelta(days=days)))]
    # only the input columns are used; the synthetic future riders in these rows are never read
    return pd.DataFrame({
        "timestamp": rows["timestamp"].to_numpy(),
        "forecast": _booster().predict(rows[feature_columns(rows)]).clip(min=0),
        "last_week": rows["lag_168"].to_numpy(),
    })


if __name__ == "__main__":
    df = build_features()
    model = train(df[df["timestamp"] < pd.Timestamp(TODAY)])
    model.booster_.save_model(MODEL_PATH)
    print(f"Model trained on data before {TODAY}, saved: {MODEL_PATH}")
