#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
from datetime import date, datetime
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]

DB = Path(os.environ.get("BUDGET_DB", BASE / "data" / "budget.db"))
BACKUPS = Path(os.environ.get("BUDGET_BACKUP_DIR", BASE / "backups"))

RCLONE_REMOTE = os.environ.get(
    "BUDGET_RCLONE_REMOTE",
    "onedrive-backup:Budget Tracker Backups",
)

BACKUPS.mkdir(parents=True, exist_ok=True)

STAMP = date.today().isoformat()

if not DB.exists():
    raise SystemExit(f"Database not found: {DB}")

sqlite_path = BACKUPS / f"{STAMP}-budget.db"
json_path = BACKUPS / f"{STAMP}-budget.json"


# ------------------------------------------------------------
# 1. Create safe SQLite snapshot
# ------------------------------------------------------------

src = sqlite3.connect(DB)
dst = sqlite3.connect(sqlite_path)

with dst:
    src.backup(dst)

dst.close()


# ------------------------------------------------------------
# 2. Verify SQLite backup integrity
# ------------------------------------------------------------

check_db = sqlite3.connect(sqlite_path)

integrity = check_db.execute("PRAGMA integrity_check").fetchone()[0]

check_db.close()

if integrity != "ok":
    sqlite_path.unlink(missing_ok=True)
    raise SystemExit(f"Backup integrity check failed: {integrity}")


# ------------------------------------------------------------
# 3. Create readable JSON export
# ------------------------------------------------------------

src.row_factory = sqlite3.Row

payload = {
    "exported_at": datetime.now().isoformat(timespec="seconds")
}

for table in (
    "categories",
    "transactions",
    "recurring",
    "planned",
):
    payload[table] = [
        dict(row)
        for row in src.execute(
            f"SELECT * FROM {table} ORDER BY id"
        )
    ]

src.close()

json_path.write_text(
    json.dumps(
        payload,
        indent=2,
        ensure_ascii=False,
    ),
    encoding="utf-8",
)


# ------------------------------------------------------------
# 4. Keep newest 30 daily backup pairs locally
# ------------------------------------------------------------

daily = sorted(
    BACKUPS.glob("????-??-??-budget.db"),
    reverse=True,
)

for old_db in daily[30:]:
    old_json = old_db.with_suffix(".json")

    old_db.unlink(missing_ok=True)
    old_json.unlink(missing_ok=True)


# ------------------------------------------------------------
# 5. First day of each month → monthly restore point
# ------------------------------------------------------------

if date.today().day == 1:
    month = date.today().strftime("%Y-%m")

    monthly_db = BACKUPS / f"monthly-{month}-budget.db"
    monthly_json = BACKUPS / f"monthly-{month}-budget.json"

    shutil.copy2(sqlite_path, monthly_db)
    shutil.copy2(json_path, monthly_json)

    monthly = sorted(
        BACKUPS.glob("monthly-????-??-budget.db"),
        reverse=True,
    )

    for old_db in monthly[12:]:
        old_json = old_db.with_suffix(".json")

        old_db.unlink(missing_ok=True)
        old_json.unlink(missing_ok=True)


# ------------------------------------------------------------
# 6. Mirror backup files to OneDrive
# ------------------------------------------------------------

rclone = shutil.which("rclone")

if not rclone:
    raise SystemExit(
        "Local backup succeeded, but rclone was not found."
    )

subprocess.run(
    [
        rclone,
        "sync",
        str(BACKUPS),
        RCLONE_REMOTE,
        "--filter",
        "+ ????-??-??-budget.db",
        "--filter",
        "+ ????-??-??-budget.json",
        "--filter",
        "+ monthly-????-??-budget.db",
        "--filter",
        "+ monthly-????-??-budget.json",
        "--filter",
        "- *",
    ],
    check=True,
)

print(
    f"Backup complete: "
    f"{sqlite_path.name}, {json_path.name}"
)

print(
    f"OneDrive sync complete: {RCLONE_REMOTE}"
)


