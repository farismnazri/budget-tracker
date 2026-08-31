from __future__ import annotations

import calendar
import json
import os
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("BUDGET_DB", BASE_DIR / "data" / "budget.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

DEFAULT_CATEGORIES = [
    ("Food", "utensils", "#ff9f43"),
    ("Groceries", "basket", "#2ed573"),
    ("Transport", "car", "#54a0ff"),
    ("Petrol", "fuel", "#a66cff"),
    ("Home", "house", "#2dd4bf"),
    ("Bills", "receipt", "#38bdf8"),
    ("Health", "heart", "#ff6b81"),
    ("Fun", "sparkles", "#f368e0"),
]

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    icon TEXT NOT NULL DEFAULT 'tag',
    color TEXT NOT NULL DEFAULT '#54a0ff',
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recurring (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    category_id INTEGER NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','yearly')),
    interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
    next_due TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS planned (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    estimated_cents INTEGER NOT NULL CHECK (estimated_cents >= 0),
    category_id INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','paid','cancelled')),
    transaction_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    spent_on TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    recurring_id INTEGER,
    planned_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(recurring_id) REFERENCES recurring(id),
    FOREIGN KEY(planned_id) REFERENCES planned(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_spent_on ON transactions(spent_on);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_due ON recurring(next_due);
CREATE INDEX IF NOT EXISTS idx_planned_due_date ON planned(due_date);
"""


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def init_db() -> None:
    with db() as conn:
        conn.executescript(SCHEMA)
        count = conn.execute("SELECT COUNT(*) AS n FROM categories").fetchone()["n"]
        if count == 0:
            conn.executemany(
                "INSERT INTO categories(name, icon, color, sort_order) VALUES(?,?,?,?)",
                [(name, icon, color, i) for i, (name, icon, color) in enumerate(DEFAULT_CATEGORIES)],
            )


def parse_iso_date(value: str | None, field: str = "date") -> date:
    try:
        return date.fromisoformat(value or "")
    except ValueError:
        raise ValueError(f"Invalid {field}. Use YYYY-MM-DD.")


def cents(value: Any, field: str = "amount") -> int:
    try:
        number = round(float(value) * 100)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid {field}.")
    if number < 0:
        raise ValueError(f"{field.title()} cannot be negative.")
    return number


def category_exists(conn: sqlite3.Connection, category_id: Any) -> int:
    try:
        cid = int(category_id)
    except (TypeError, ValueError):
        raise ValueError("Invalid category.")
    row = conn.execute("SELECT id FROM categories WHERE id=?", (cid,)).fetchone()
    if not row:
        raise ValueError("Category does not exist.")
    return cid


def tx_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "amount": row["amount_cents"] / 100,
        "spent_on": row["spent_on"],
        "category_id": row["category_id"],
        "category": row["category_name"],
        "icon": row["icon"],
        "color": row["color"],
        "note": row["note"],
        "recurring_id": row["recurring_id"],
        "planned_id": row["planned_id"],
    }


def advance_due(current: date, frequency: str, interval_count: int) -> date:
    if frequency == "weekly":
        return current + timedelta(weeks=interval_count)
    if frequency == "monthly":
        month_index = current.year * 12 + current.month - 1 + interval_count
        year, month0 = divmod(month_index, 12)
        month = month0 + 1
        day = min(current.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)
    if frequency == "yearly":
        year = current.year + interval_count
        day = min(current.day, calendar.monthrange(year, current.month)[1])
        return date(year, current.month, day)
    raise ValueError("Unsupported frequency.")


def period_bounds(period: str, anchor: date) -> tuple[date, date, str]:
    if period == "day":
        return anchor, anchor, anchor.strftime("%A, %d %B")
    if period == "week":
        start = anchor - timedelta(days=anchor.weekday())
        end = start + timedelta(days=6)
        return start, end, f"{start.strftime('%d %b')} – {end.strftime('%d %b')}"
    if period == "month":
        start = anchor.replace(day=1)
        end = anchor.replace(day=calendar.monthrange(anchor.year, anchor.month)[1])
        return start, end, anchor.strftime("%B %Y")
    if period == "year":
        return date(anchor.year, 1, 1), date(anchor.year, 12, 31), str(anchor.year)
    raise ValueError("period must be day, week, month, or year")


def previous_bounds(period: str, start: date, end: date) -> tuple[date, date]:
    if period == "day":
        return start - timedelta(days=1), end - timedelta(days=1)
    if period == "week":
        return start - timedelta(days=7), end - timedelta(days=7)
    if period == "month":
        prev_end = start - timedelta(days=1)
        return prev_end.replace(day=1), prev_end
    if period == "year":
        return date(start.year - 1, 1, 1), date(start.year - 1, 12, 31)
    raise ValueError("Unsupported period")


def historical_month_trajectory(conn: sqlite3.Connection, anchor: date, months: int = 6) -> dict[str, Any]:
    current_start = anchor.replace(day=1)
    current_last = calendar.monthrange(anchor.year, anchor.month)[1]
    rows = conn.execute(
        """
        SELECT spent_on, SUM(amount_cents) AS total
        FROM transactions
        WHERE spent_on >= ? AND spent_on <= ?
        GROUP BY spent_on
        ORDER BY spent_on
        """,
        (current_start.isoformat(), anchor.isoformat()),
    ).fetchall()
    current_by_day = {date.fromisoformat(r["spent_on"]).day: r["total"] / 100 for r in rows}
    current_cumulative = []
    running = 0.0
    for day_num in range(1, current_last + 1):
        if day_num <= anchor.day:
            running += current_by_day.get(day_num, 0)
            current_cumulative.append(round(running, 2))
        else:
            current_cumulative.append(None)

    sample_months: list[tuple[int, int]] = []
    y, m = anchor.year, anchor.month
    for _ in range(months):
        m -= 1
        if m == 0:
            y -= 1
            m = 12
        sample_months.append((y, m))

    histories: list[list[float | None]] = []
    for y, m in sample_months:
        first = date(y, m, 1)
        last_day = calendar.monthrange(y, m)[1]
        last = date(y, m, last_day)
        any_row = conn.execute(
            "SELECT 1 FROM transactions WHERE spent_on BETWEEN ? AND ? LIMIT 1",
            (first.isoformat(), last.isoformat()),
        ).fetchone()
        if not any_row:
            continue
        rs = conn.execute(
            "SELECT spent_on, SUM(amount_cents) AS total FROM transactions WHERE spent_on BETWEEN ? AND ? GROUP BY spent_on",
            (first.isoformat(), last.isoformat()),
        ).fetchall()
        by_day = {date.fromisoformat(r["spent_on"]).day: r["total"] / 100 for r in rs}
        run = 0.0
        series: list[float | None] = []
        for d in range(1, current_last + 1):
            if d <= last_day:
                run += by_day.get(d, 0)
                series.append(run)
            else:
                series.append(None)
        histories.append(series)

    typical: list[float | None] = []
    for i in range(current_last):
        vals = [s[i] for s in histories if s[i] is not None]
        typical.append(round(sum(vals) / len(vals), 2) if vals else None)

    projected = None
    if anchor.day > 0 and current_cumulative[anchor.day - 1] is not None:
        current_total = float(current_cumulative[anchor.day - 1] or 0)
        typical_today = typical[anchor.day - 1] if anchor.day - 1 < len(typical) else None
        typical_end = next((v for v in reversed(typical) if v is not None), None)
        if typical_today and typical_end:
            projected = round(current_total * (typical_end / typical_today), 2)
        elif anchor.day:
            projected = round(current_total / anchor.day * current_last, 2)

    return {
        "labels": [str(d) for d in range(1, current_last + 1)],
        "current": current_cumulative,
        "typical": typical,
        "samples": len(histories),
        "projected": projected,
    }


@app.errorhandler(ValueError)
def handle_value_error(exc: ValueError):
    return jsonify({"error": str(exc)}), 400


@app.errorhandler(sqlite3.IntegrityError)
def handle_integrity_error(exc: sqlite3.IntegrityError):
    message = "That value conflicts with existing data."
    if "categories.name" in str(exc):
        message = "A category with that name already exists."
    return jsonify({"error": message}), 400


@app.get("/")
def index():
    return render_template("index.html", today=date.today().isoformat())


@app.get("/manifest.webmanifest")
def manifest():
    return app.send_static_file("manifest.webmanifest")


@app.get("/sw.js")
def sw():
    response = app.send_static_file("sw.js")
    response.headers["Service-Worker-Allowed"] = "/"
    return response


@app.get("/api/health")
def health():
    with db() as conn:
        conn.execute("SELECT 1").fetchone()
    return jsonify({"ok": True, "database": str(DB_PATH)})


@app.get("/api/bootstrap")
def bootstrap():
    today = date.today()
    month_start = today.replace(day=1)
    with db() as conn:
        categories = [dict(r) for r in conn.execute(
            "SELECT id,name,icon,color,archived,sort_order FROM categories ORDER BY archived, sort_order, name"
        )]
        transactions = [tx_row(r) for r in conn.execute(
            """
            SELECT t.*, c.name category_name, c.icon, c.color
            FROM transactions t JOIN categories c ON c.id=t.category_id
            WHERE t.spent_on=? ORDER BY t.id DESC
            """, (today.isoformat(),)
        )]
        month_total = conn.execute(
            "SELECT COALESCE(SUM(amount_cents),0) total FROM transactions WHERE spent_on BETWEEN ? AND ?",
            (month_start.isoformat(), today.isoformat()),
        ).fetchone()["total"] / 100
        due_recurring = conn.execute(
            "SELECT COUNT(*) n FROM recurring WHERE active=1 AND next_due <= ?", (today.isoformat(),)
        ).fetchone()["n"]
        due_planned = conn.execute(
            "SELECT COUNT(*) n FROM planned WHERE status='upcoming' AND due_date <= ?", (today.isoformat(),)
        ).fetchone()["n"]
    return jsonify({
        "today": today.isoformat(),
        "categories": categories,
        "today_transactions": transactions,
        "month_total": month_total,
        "due_count": due_recurring + due_planned,
    })


@app.get("/api/transactions")
def list_transactions():
    start = request.args.get("start")
    end = request.args.get("end")
    category_id = request.args.get("category_id")
    limit = min(max(int(request.args.get("limit", 200)), 1), 1000)
    clauses, params = [], []
    if start:
        parse_iso_date(start, "start")
        clauses.append("t.spent_on >= ?")
        params.append(start)
    if end:
        parse_iso_date(end, "end")
        clauses.append("t.spent_on <= ?")
        params.append(end)
    if category_id:
        clauses.append("t.category_id = ?")
        params.append(int(category_id))
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    with db() as conn:
        rows = conn.execute(
            f"""
            SELECT t.*, c.name category_name, c.icon, c.color
            FROM transactions t JOIN categories c ON c.id=t.category_id
            {where}
            ORDER BY t.spent_on DESC, t.id DESC LIMIT ?
            """, (*params, limit)
        ).fetchall()
    return jsonify([tx_row(r) for r in rows])


@app.post("/api/transactions")
def create_transaction():
    payload = request.get_json(force=True)
    amount_cents = cents(payload.get("amount"))
    if amount_cents == 0:
        raise ValueError("Amount must be greater than zero.")
    spent_on = parse_iso_date(payload.get("spent_on") or date.today().isoformat()).isoformat()
    note = str(payload.get("note") or "").strip()[:240]
    with db() as conn:
        cid = category_exists(conn, payload.get("category_id"))
        cur = conn.execute(
            "INSERT INTO transactions(amount_cents,spent_on,category_id,note) VALUES(?,?,?,?)",
            (amount_cents, spent_on, cid, note),
        )
        row = conn.execute(
            """SELECT t.*, c.name category_name,c.icon,c.color FROM transactions t
            JOIN categories c ON c.id=t.category_id WHERE t.id=?""", (cur.lastrowid,)
        ).fetchone()
    return jsonify(tx_row(row)), 201


@app.put("/api/transactions/<int:tx_id>")
def update_transaction(tx_id: int):
    payload = request.get_json(force=True)
    with db() as conn:
        existing = conn.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone()
        if not existing:
            return jsonify({"error": "Transaction not found."}), 404
        amount_cents = cents(payload.get("amount", existing["amount_cents"] / 100))
        if amount_cents == 0:
            raise ValueError("Amount must be greater than zero.")
        spent_on = parse_iso_date(payload.get("spent_on", existing["spent_on"])).isoformat()
        cid = category_exists(conn, payload.get("category_id", existing["category_id"]))
        note = str(payload.get("note", existing["note"]) or "").strip()[:240]
        conn.execute(
            "UPDATE transactions SET amount_cents=?,spent_on=?,category_id=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (amount_cents, spent_on, cid, note, tx_id),
        )
        row = conn.execute(
            """SELECT t.*, c.name category_name,c.icon,c.color FROM transactions t
            JOIN categories c ON c.id=t.category_id WHERE t.id=?""", (tx_id,)
        ).fetchone()
    return jsonify(tx_row(row))


@app.delete("/api/transactions/<int:tx_id>")
def delete_transaction(tx_id: int):
    with db() as conn:
        row = conn.execute("SELECT planned_id FROM transactions WHERE id=?", (tx_id,)).fetchone()
        if not row:
            return jsonify({"error": "Transaction not found."}), 404
        if row["planned_id"]:
            conn.execute("UPDATE planned SET status='upcoming', transaction_id=NULL WHERE id=?", (row["planned_id"],))
        conn.execute("DELETE FROM transactions WHERE id=?", (tx_id,))
    return jsonify({"ok": True})


@app.get("/api/categories")
def list_categories():
    include_archived = request.args.get("include_archived", "0") == "1"
    where = "" if include_archived else "WHERE archived=0"
    with db() as conn:
        rows = conn.execute(
            f"SELECT id,name,icon,color,archived,sort_order FROM categories {where} ORDER BY archived,sort_order,name"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/categories")
def create_category():
    payload = request.get_json(force=True)
    name = str(payload.get("name") or "").strip()[:40]
    if not name:
        raise ValueError("Category name is required.")
    icon = str(payload.get("icon") or "tag")[:30]
    color = str(payload.get("color") or "#54a0ff")[:20]
    with db() as conn:
        sort_order = conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 n FROM categories").fetchone()["n"]
        cur = conn.execute(
            "INSERT INTO categories(name,icon,color,sort_order) VALUES(?,?,?,?)",
            (name, icon, color, sort_order),
        )
        row = conn.execute("SELECT id,name,icon,color,archived,sort_order FROM categories WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.put("/api/categories/<int:category_id>")
def update_category(category_id: int):
    payload = request.get_json(force=True)
    with db() as conn:
        row = conn.execute("SELECT * FROM categories WHERE id=?", (category_id,)).fetchone()
        if not row:
            return jsonify({"error": "Category not found."}), 404
        name = str(payload.get("name", row["name"])).strip()[:40]
        if not name:
            raise ValueError("Category name is required.")
        icon = str(payload.get("icon", row["icon"]))[:30]
        color = str(payload.get("color", row["color"]))[:20]
        archived = 1 if payload.get("archived", bool(row["archived"])) else 0
        conn.execute("UPDATE categories SET name=?,icon=?,color=?,archived=? WHERE id=?", (name, icon, color, archived, category_id))
        updated = conn.execute("SELECT id,name,icon,color,archived,sort_order FROM categories WHERE id=?", (category_id,)).fetchone()
    return jsonify(dict(updated))


@app.delete("/api/categories/<int:category_id>")
def delete_or_archive_category(category_id: int):
    with db() as conn:
        row = conn.execute("SELECT * FROM categories WHERE id=?", (category_id,)).fetchone()
        if not row:
            return jsonify({"error": "Category not found."}), 404
        used = conn.execute("SELECT 1 FROM transactions WHERE category_id=? LIMIT 1", (category_id,)).fetchone()
        used = used or conn.execute("SELECT 1 FROM recurring WHERE category_id=? LIMIT 1", (category_id,)).fetchone()
        used = used or conn.execute("SELECT 1 FROM planned WHERE category_id=? LIMIT 1", (category_id,)).fetchone()
        if used:
            conn.execute("UPDATE categories SET archived=1 WHERE id=?", (category_id,))
            return jsonify({"ok": True, "action": "archived"})
        conn.execute("DELETE FROM categories WHERE id=?", (category_id,))
    return jsonify({"ok": True, "action": "deleted"})


@app.get("/api/trends")
def trends():
    period = request.args.get("period", "month")
    anchor = parse_iso_date(request.args.get("anchor") or date.today().isoformat(), "anchor")
    start, end, label = period_bounds(period, anchor)
    prev_start, prev_end = previous_bounds(period, start, end)
    with db() as conn:
        total_cents = conn.execute(
            "SELECT COALESCE(SUM(amount_cents),0) total FROM transactions WHERE spent_on BETWEEN ? AND ?",
            (start.isoformat(), end.isoformat()),
        ).fetchone()["total"]
        prev_cents = conn.execute(
            "SELECT COALESCE(SUM(amount_cents),0) total FROM transactions WHERE spent_on BETWEEN ? AND ?",
            (prev_start.isoformat(), prev_end.isoformat()),
        ).fetchone()["total"]
        categories = [dict(r) for r in conn.execute(
            """
            SELECT c.id,c.name,c.icon,c.color,SUM(t.amount_cents)/100.0 AS total
            FROM transactions t JOIN categories c ON c.id=t.category_id
            WHERE t.spent_on BETWEEN ? AND ?
            GROUP BY c.id,c.name,c.icon,c.color ORDER BY SUM(t.amount_cents) DESC
            """, (start.isoformat(), end.isoformat())
        )]

        if period == "year":
            bucket_rows = conn.execute(
                """SELECT substr(spent_on,1,7) bucket,SUM(amount_cents)/100.0 total
                FROM transactions WHERE spent_on BETWEEN ? AND ? GROUP BY bucket ORDER BY bucket""",
                (start.isoformat(), end.isoformat()),
            ).fetchall()
            bucket_map = {r["bucket"]: r["total"] for r in bucket_rows}
            buckets = [{"label": calendar.month_abbr[m], "total": round(bucket_map.get(f"{anchor.year}-{m:02d}", 0), 2)} for m in range(1, 13)]
        else:
            bucket_rows = conn.execute(
                """SELECT spent_on bucket,SUM(amount_cents)/100.0 total
                FROM transactions WHERE spent_on BETWEEN ? AND ? GROUP BY spent_on ORDER BY spent_on""",
                (start.isoformat(), end.isoformat()),
            ).fetchall()
            bucket_map = {r["bucket"]: r["total"] for r in bucket_rows}
            days = (end - start).days + 1
            buckets = []
            for i in range(days):
                d = start + timedelta(days=i)
                if period == "day":
                    lbl = d.strftime("%d %b")
                elif period == "week":
                    lbl = d.strftime("%a")
                else:
                    lbl = str(d.day)
                buckets.append({"label": lbl, "date": d.isoformat(), "total": round(bucket_map.get(d.isoformat(), 0), 2)})

        trajectory = historical_month_trajectory(conn, min(anchor, date.today()) if period == "month" and anchor.year == date.today().year and anchor.month == date.today().month else end) if period == "month" else None

    total = total_cents / 100
    previous = prev_cents / 100
    delta = round(total - previous, 2)
    percent = None if previous == 0 else round((total - previous) / previous * 100, 1)
    return jsonify({
        "period": period,
        "label": label,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total": round(total, 2),
        "previous_total": round(previous, 2),
        "delta": delta,
        "percent_change": percent,
        "categories": categories,
        "buckets": buckets,
        "trajectory": trajectory,
    })


@app.get("/api/recurring")
def list_recurring():
    with db() as conn:
        rows = conn.execute(
            """
            SELECT r.*, c.name category_name,c.icon,c.color
            FROM recurring r JOIN categories c ON c.id=r.category_id
            ORDER BY r.active DESC, r.next_due, r.name
            """
        ).fetchall()
    return jsonify([{**dict(r), "amount": r["amount_cents"] / 100} for r in rows])


@app.post("/api/recurring")
def create_recurring():
    p = request.get_json(force=True)
    name = str(p.get("name") or "").strip()[:80]
    if not name:
        raise ValueError("Name is required.")
    amount_cents = cents(p.get("amount"))
    due = parse_iso_date(p.get("next_due"), "next due")
    start = parse_iso_date(p.get("start_date") or due.isoformat(), "start date")
    end = parse_iso_date(p.get("end_date"), "end date") if p.get("end_date") else None
    frequency = str(p.get("frequency") or "monthly")
    if frequency not in {"weekly", "monthly", "yearly"}:
        raise ValueError("Invalid frequency.")
    interval_count = max(int(p.get("interval_count") or 1), 1)
    with db() as conn:
        cid = category_exists(conn, p.get("category_id"))
        cur = conn.execute(
            """INSERT INTO recurring(name,amount_cents,category_id,frequency,interval_count,next_due,start_date,end_date)
            VALUES(?,?,?,?,?,?,?,?)""",
            (name, amount_cents, cid, frequency, interval_count, due.isoformat(), start.isoformat(), end.isoformat() if end else None),
        )
    return jsonify({"id": cur.lastrowid}), 201


@app.put("/api/recurring/<int:item_id>")
def update_recurring(item_id: int):
    p = request.get_json(force=True)
    with db() as conn:
        row = conn.execute("SELECT * FROM recurring WHERE id=?", (item_id,)).fetchone()
        if not row:
            return jsonify({"error": "Recurring payment not found."}), 404
        fields = {
            "name": str(p.get("name", row["name"])).strip()[:80],
            "amount_cents": cents(p.get("amount", row["amount_cents"] / 100)),
            "category_id": category_exists(conn, p.get("category_id", row["category_id"])),
            "frequency": str(p.get("frequency", row["frequency"])),
            "interval_count": max(int(p.get("interval_count", row["interval_count"])), 1),
            "next_due": parse_iso_date(p.get("next_due", row["next_due"]), "next due").isoformat(),
            "active": 1 if p.get("active", bool(row["active"])) else 0,
        }
        if fields["frequency"] not in {"weekly", "monthly", "yearly"}:
            raise ValueError("Invalid frequency.")
        conn.execute(
            """UPDATE recurring SET name=:name,amount_cents=:amount_cents,category_id=:category_id,
            frequency=:frequency,interval_count=:interval_count,next_due=:next_due,active=:active WHERE id=:id""",
            {**fields, "id": item_id},
        )
    return jsonify({"ok": True})


@app.delete("/api/recurring/<int:item_id>")
def archive_recurring(item_id: int):
    with db() as conn:
        changed = conn.execute("UPDATE recurring SET active=0 WHERE id=?", (item_id,)).rowcount
    if not changed:
        return jsonify({"error": "Recurring payment not found."}), 404
    return jsonify({"ok": True})


@app.post("/api/recurring/<int:item_id>/pay")
def pay_recurring(item_id: int):
    p = request.get_json(silent=True) or {}
    paid_on = parse_iso_date(p.get("paid_on") or date.today().isoformat(), "paid date")
    with db() as conn:
        row = conn.execute("SELECT * FROM recurring WHERE id=? AND active=1", (item_id,)).fetchone()
        if not row:
            return jsonify({"error": "Recurring payment not found or inactive."}), 404
        actual = cents(p.get("amount", row["amount_cents"] / 100))
        note = str(p.get("note") or row["name"]).strip()[:240]
        cur = conn.execute(
            "INSERT INTO transactions(amount_cents,spent_on,category_id,note,recurring_id) VALUES(?,?,?,?,?)",
            (actual, paid_on.isoformat(), row["category_id"], note, item_id),
        )
        next_due = advance_due(date.fromisoformat(row["next_due"]), row["frequency"], row["interval_count"])
        active = 0 if row["end_date"] and next_due > date.fromisoformat(row["end_date"]) else 1
        conn.execute("UPDATE recurring SET next_due=?, active=? WHERE id=?", (next_due.isoformat(), active, item_id))
    return jsonify({"ok": True, "transaction_id": cur.lastrowid, "next_due": next_due.isoformat(), "active": bool(active)})


@app.get("/api/planned")
def list_planned():
    with db() as conn:
        rows = conn.execute(
            """SELECT p.*,c.name category_name,c.icon,c.color FROM planned p
            JOIN categories c ON c.id=p.category_id ORDER BY CASE p.status WHEN 'upcoming' THEN 0 ELSE 1 END,p.due_date,p.name"""
        ).fetchall()
    return jsonify([{**dict(r), "estimated_amount": r["estimated_cents"] / 100} for r in rows])


@app.post("/api/planned")
def create_planned():
    p = request.get_json(force=True)
    name = str(p.get("name") or "").strip()[:80]
    if not name:
        raise ValueError("Name is required.")
    estimate = cents(p.get("estimated_amount"), "estimated amount")
    due = parse_iso_date(p.get("due_date"), "due date")
    with db() as conn:
        cid = category_exists(conn, p.get("category_id"))
        cur = conn.execute(
            "INSERT INTO planned(name,estimated_cents,category_id,due_date) VALUES(?,?,?,?)",
            (name, estimate, cid, due.isoformat()),
        )
    return jsonify({"id": cur.lastrowid}), 201


@app.put("/api/planned/<int:item_id>")
def update_planned(item_id: int):
    p = request.get_json(force=True)
    with db() as conn:
        row = conn.execute("SELECT * FROM planned WHERE id=?", (item_id,)).fetchone()
        if not row:
            return jsonify({"error": "Planned payment not found."}), 404
        if row["status"] == "paid":
            raise ValueError("Paid planned items should be edited through their transaction.")
        name = str(p.get("name", row["name"])).strip()[:80]
        estimate = cents(p.get("estimated_amount", row["estimated_cents"] / 100), "estimated amount")
        cid = category_exists(conn, p.get("category_id", row["category_id"]))
        due = parse_iso_date(p.get("due_date", row["due_date"]), "due date").isoformat()
        status = str(p.get("status", row["status"]))
        if status not in {"upcoming", "cancelled"}:
            raise ValueError("Invalid status.")
        conn.execute("UPDATE planned SET name=?,estimated_cents=?,category_id=?,due_date=?,status=? WHERE id=?", (name, estimate, cid, due, status, item_id))
    return jsonify({"ok": True})


@app.delete("/api/planned/<int:item_id>")
def cancel_planned(item_id: int):
    with db() as conn:
        changed = conn.execute("UPDATE planned SET status='cancelled' WHERE id=? AND status='upcoming'", (item_id,)).rowcount
    if not changed:
        return jsonify({"error": "Upcoming planned payment not found."}), 404
    return jsonify({"ok": True})


@app.post("/api/planned/<int:item_id>/pay")
def pay_planned(item_id: int):
    p = request.get_json(silent=True) or {}
    paid_on = parse_iso_date(p.get("paid_on") or date.today().isoformat(), "paid date")
    with db() as conn:
        row = conn.execute("SELECT * FROM planned WHERE id=? AND status='upcoming'", (item_id,)).fetchone()
        if not row:
            return jsonify({"error": "Upcoming planned payment not found."}), 404
        actual = cents(p.get("amount", row["estimated_cents"] / 100))
        note = str(p.get("note") or row["name"]).strip()[:240]
        cur = conn.execute(
            "INSERT INTO transactions(amount_cents,spent_on,category_id,note,planned_id) VALUES(?,?,?,?,?)",
            (actual, paid_on.isoformat(), row["category_id"], note, item_id),
        )
        conn.execute("UPDATE planned SET status='paid',transaction_id=? WHERE id=?", (cur.lastrowid, item_id))
    return jsonify({"ok": True, "transaction_id": cur.lastrowid})


@app.get("/api/upcoming")
def upcoming():
    today = date.today()
    horizon = today + timedelta(days=max(min(int(request.args.get("days", 30)), 365), 1))
    with db() as conn:
        recurring_rows = conn.execute(
            """SELECT r.*,c.name category_name,c.icon,c.color FROM recurring r JOIN categories c ON c.id=r.category_id
            WHERE r.active=1 AND r.next_due <= ? ORDER BY r.next_due""", (horizon.isoformat(),)
        ).fetchall()
        planned_rows = conn.execute(
            """SELECT p.*,c.name category_name,c.icon,c.color FROM planned p JOIN categories c ON c.id=p.category_id
            WHERE p.status='upcoming' AND p.due_date <= ? ORDER BY p.due_date""", (horizon.isoformat(),)
        ).fetchall()
    recurring_items = [{**dict(r), "amount": r["amount_cents"] / 100, "kind": "recurring", "due_date": r["next_due"]} for r in recurring_rows]
    planned_items = [{**dict(r), "amount": r["estimated_cents"] / 100, "kind": "planned"} for r in planned_rows]
    items = sorted(recurring_items + planned_items, key=lambda x: x["due_date"])
    return jsonify({"items": items, "total": round(sum(i["amount"] for i in items), 2), "through": horizon.isoformat()})


@app.get("/api/export")
def export_json():
    with db() as conn:
        payload = {
            "exported_at": datetime.now().isoformat(timespec="seconds"),
            "categories": [dict(r) for r in conn.execute("SELECT * FROM categories ORDER BY id")],
            "transactions": [dict(r) for r in conn.execute("SELECT * FROM transactions ORDER BY spent_on,id")],
            "recurring": [dict(r) for r in conn.execute("SELECT * FROM recurring ORDER BY id")],
            "planned": [dict(r) for r in conn.execute("SELECT * FROM planned ORDER BY id")],
        }
    response = jsonify(payload)
    response.headers["Content-Disposition"] = f"attachment; filename=budget-export-{date.today().isoformat()}.json"
    return response


init_db()

if __name__ == "__main__":
    app.run(host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "5055")), debug=False)
