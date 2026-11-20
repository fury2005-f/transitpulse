# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""Naive benchmark: predict that each hour will look exactly like the same hour last week."""

import pandas as pd


def predict(df: pd.DataFrame) -> pd.Series:
    return df["lag_168"]
