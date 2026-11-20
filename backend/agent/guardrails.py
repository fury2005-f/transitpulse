# ALL DATA IS SYNTHETIC — this is a method demonstration.
"""Safety layer for the agent's run_sql tool.

Layer 1  text checks: one statement, SELECT/WITH only, no write/admin keywords, no comments,
         no schema-qualified names, no SQLite internals.
Layer 2  read-only connection (mode=ro): the database file cannot be written at all.
Layer 3  authorizer: SQLite reports every table a query reads; only the 4 allowed tables pass.
Layer 4  limits: at most MAX_ROWS rows and TIMEOUT_S seconds per query.

The ridership table is shadowed by a view that hides rows from TODAY onwards, so the agent has to
use the forecast tools for the future instead of reading the synthetic "answers".
"""

import re
import sqlite3
import time
from contextlib import closing
from pathlib import Path

from database import DB_PATH, TODAY

ALLOWED_TABLES = frozenset({"ridership", "weather", "holidays", "nationality_profiles", "capacity_limits"})
MAX_ROWS = 200
MAX_QUERY_CHARS = 2000
TIMEOUT_S = 3.0

_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|attach|detach|pragma|create|vacuum|reindex|"
    r"replace\s+into|load_extension)\b",
    re.IGNORECASE,
)
_SCHEMA_QUALIFIED = re.compile(r"\b(main|temp)\s*\.", re.IGNORECASE)
_INTERNALS = re.compile(r"\bsqlite_", re.IGNORECASE)


class GuardrailError(ValueError):
    pass


def validate_sql(query: str) -> str:
    """Return the query wrapped with a row limit, or raise GuardrailError."""
    sql = (query or "").strip()
    if not sql:
        raise GuardrailError("Empty query.")
    if len(sql) > MAX_QUERY_CHARS:
        raise GuardrailError(f"Query longer than {MAX_QUERY_CHARS} characters.")
    if "--" in sql or "/*" in sql:
        raise GuardrailError("SQL comments are not allowed.")
    if sql.endswith(";"):
        sql = sql[:-1].rstrip()
    if ";" in sql:
        raise GuardrailError("Only one statement is allowed.")
    if not re.match(r"(select|with)\b", sql, re.IGNORECASE):
        raise GuardrailError("Only SELECT queries are allowed.")
    if m := _FORBIDDEN.search(sql):
        raise GuardrailError(f"Keyword not allowed: {m.group(1).upper()}.")
    unquoted = re.sub(r'["`\[\]]', "", sql)  # so "main"."ridership" can't dodge the check
    if _SCHEMA_QUALIFIED.search(unquoted) or _INTERNALS.search(unquoted):
        raise GuardrailError(f"Only these tables can be queried: {', '.join(sorted(ALLOWED_TABLES))}.")
    return f"SELECT * FROM ({sql}) LIMIT {MAX_ROWS + 1}"


def _authorize(action, table, _column, db, source):
    if action in (sqlite3.SQLITE_SELECT, sqlite3.SQLITE_FUNCTION):
        return sqlite3.SQLITE_OK
    if action == sqlite3.SQLITE_READ and table in ALLOWED_TABLES:
        # the real ridership table is only reachable through the hide-the-future view
        if table == "ridership" and db == "main" and source != "ridership":
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK
    return sqlite3.SQLITE_DENY


def connect_readonly() -> sqlite3.Connection:
    conn = sqlite3.connect(Path(DB_PATH).as_uri() + "?mode=ro", uri=True)
    conn.execute(
        f"CREATE TEMP VIEW ridership AS SELECT * FROM main.ridership WHERE timestamp < '{TODAY.isoformat()}'"
    )
    conn.set_authorizer(_authorize)
    return conn


def run_safe_query(query: str) -> dict:
    sql = validate_sql(query)
    deadline = time.monotonic() + TIMEOUT_S
    with closing(connect_readonly()) as conn:
        conn.set_progress_handler(lambda: time.monotonic() > deadline, 10_000)
        try:
            cur = conn.execute(sql)
            rows = cur.fetchmany(MAX_ROWS + 1)
        except sqlite3.DatabaseError as e:
            msg = str(e)
            if "interrupted" in msg:
                raise GuardrailError(f"Query stopped after {TIMEOUT_S:g} seconds. Add filters or aggregate.") from e
            if "not authorized" in msg:
                raise GuardrailError(
                    f"Query not permitted. Only SELECT on: {', '.join(sorted(ALLOWED_TABLES))}.") from e
            raise ValueError(f"SQL error: {msg}") from e
        columns = [c[0] for c in cur.description]
    return {
        "sql": sql,
        "columns": columns,
        "rows": [list(r) for r in rows[:MAX_ROWS]],
        "row_count": min(len(rows), MAX_ROWS),
        "truncated": len(rows) > MAX_ROWS,
    }
