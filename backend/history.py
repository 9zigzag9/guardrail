"""History of past checks, stored in SQLite (SQL injection defence).

Every prompt this application stores is, by design, possibly an attack string, so no query here
is ever built by pasting input into the SQL text. Every value travels as a parameter (the `?`
placeholders), which the database treats strictly as data. The SQL text itself is fixed.

Rows belong to a browser session (a random UUID the front end sends in X-Session-Id), and every
query filters on it, so one session can never read, search or delete another session's checks.
"""
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS checks (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id         TEXT    NOT NULL,
    created_at         TEXT    NOT NULL,
    text               TEXT    NOT NULL,
    decision           TEXT    NOT NULL,
    attack_probability REAL    NOT NULL,
    category           TEXT
);
CREATE INDEX IF NOT EXISTS checks_by_session ON checks (session_id, id);
"""

COLUMNS = "id, created_at, text, decision, attack_probability, category"

INSERT = ("INSERT INTO checks (session_id, created_at, text, decision, attack_probability, category) "
          "VALUES (?, ?, ?, ?, ?, ?)")
# Keep only each session's newest rows, so one session cannot grow the database without limit.
TRIM = ("DELETE FROM checks WHERE session_id = ? AND id NOT IN "
        "(SELECT id FROM checks WHERE session_id = ? ORDER BY id DESC LIMIT ?)")
# The search term is a parameter too, and LIKE's own wildcards (% and _) in it are escaped,
# so a search for "%" finds a literal percent sign rather than matching everything.
LIST = (f"SELECT {COLUMNS} FROM checks WHERE session_id = ? "
        "AND (? IS NULL OR decision = ?) "
        "AND (? IS NULL OR text LIKE ? ESCAPE '\\') "
        "ORDER BY id DESC LIMIT ?")
GET = f"SELECT {COLUMNS} FROM checks WHERE id = ? AND session_id = ?"
CLEAR = "DELETE FROM checks WHERE session_id = ?"


def _connect(path: str) -> sqlite3.Connection:
    con = sqlite3.connect(path, timeout=5)
    con.row_factory = sqlite3.Row
    return con


def init_db(path: str) -> None:
    with closing(_connect(path)) as con, con:
        con.execute("PRAGMA journal_mode=WAL")      # readers do not block the writer
        con.executescript(SCHEMA)                  # fixed text, no input involved


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def add_check(path: str, session_id: str, text: str, decision: str, probability: float,
              category: str | None, keep: int) -> int:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with closing(_connect(path)) as con, con:
        row_id = con.execute(INSERT, (session_id, now, text, decision, probability, category)).lastrowid
        con.execute(TRIM, (session_id, session_id, keep))
    return row_id


def list_checks(path: str, session_id: str, decision: str | None, search: str | None, limit: int) -> list[dict]:
    pattern = f"%{_escape_like(search)}%" if search else None
    with closing(_connect(path)) as con:
        rows = con.execute(LIST, (session_id, decision, decision, pattern, pattern, limit)).fetchall()
    return [dict(r) for r in rows]


def get_check(path: str, session_id: str, check_id: int) -> dict | None:
    with closing(_connect(path)) as con:
        row = con.execute(GET, (check_id, session_id)).fetchone()
    return dict(row) if row else None


def clear_checks(path: str, session_id: str) -> int:
    with closing(_connect(path)) as con, con:
        return con.execute(CLEAR, (session_id,)).rowcount
