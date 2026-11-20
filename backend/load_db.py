# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""Loads the CSVs from generate_data.py into ops.db (drops and rebuilds every table)."""

import os
from contextlib import closing

import pandas as pd

from database import DB_PATH, SCHEMA, connect

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
TABLES = ["ridership", "weather", "holidays", "nationality_profiles"]


def load():
    with closing(connect()) as conn:
        conn.executescript(SCHEMA)
        for table in TABLES:
            df = pd.read_csv(os.path.join(DATA_DIR, f"{table}.csv"))
            df.to_sql(table, conn, if_exists="append", index=False, chunksize=50_000)
            print(f"{len(df):>9,} rows -> {table}")
        conn.commit()
    print(f"Database ready: {DB_PATH}")


if __name__ == "__main__":
    load()
