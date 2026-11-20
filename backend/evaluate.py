# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""Trains on data before TEST_START, then compares model vs baseline MAPE on the held-out months."""

import numpy as np
import pandas as pd

import baseline
import forecast
from features import build_features

TEST_START = "2025-10-01"  # Oct-Dec 2025: includes Golden Week, Dussehra, Diwali, Christmas


def mape(actual: pd.Series, predicted) -> float:
    """Mean absolute percentage error, skipping hours with zero riders (division by zero)."""
    a, p = np.asarray(actual, float), np.asarray(predicted, float)
    keep = a > 0
    return float(np.mean(np.abs(a[keep] - p[keep]) / a[keep]) * 100)


def main():
    df = build_features()
    train_df = df[df["timestamp"] < TEST_START]
    test = df[df["timestamp"] >= TEST_START].copy()
    print(f"Train: {len(train_df):,} rows to {TEST_START} | Test: {len(test):,} rows from {TEST_START}\n")

    model = forecast.train(train_df)
    test["model"] = forecast.predict(model, test)
    test["baseline"] = baseline.predict(test)

    any_hol = test.filter(like="hol_").sum(axis=1) > 0
    groups = [(loc, test[test["location"] == loc]) for loc in test["location"].cat.categories]
    groups += [("ALL LOCATIONS", test), ("holiday days only", test[any_hol])]

    print(f"{'Location':<20}{'Model MAPE':>12}{'Baseline MAPE':>15}{'Improvement':>13}")
    print("-" * 60)
    for name, g in groups:
        m, b = mape(g["riders"], g["model"]), mape(g["riders"], g["baseline"])
        print(f"{name:<20}{m:>11.1f}%{b:>14.1f}%{(b - m) / b:>12.0%}")


if __name__ == "__main__":
    main()
