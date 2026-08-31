#!/usr/bin/env python3
from __future__ import annotations
import json, os, sqlite3
from datetime import date, datetime
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
DB = Path(os.environ.get('BUDGET_DB', BASE / 'data' / 'budget.db'))
BACKUPS = Path(os.environ.get('BUDGET_BACKUP_DIR', BASE / 'backups'))
BACKUPS.mkdir(parents=True, exist_ok=True)
STAMP = date.today().isoformat()

if not DB.exists():
    raise SystemExit(f'Database not found: {DB}')

sqlite_path = BACKUPS / f'{STAMP}-budget.db'
json_path = BACKUPS / f'{STAMP}-budget.json'

src = sqlite3.connect(DB)
dst = sqlite3.connect(sqlite_path)
with dst:
    src.backup(dst)
dst.close()
src.row_factory = sqlite3.Row
payload = {'exported_at': datetime.now().isoformat(timespec='seconds')}
for table in ('categories','transactions','recurring','planned'):
    payload[table] = [dict(r) for r in src.execute(f'SELECT * FROM {table} ORDER BY id')]
src.close()
json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')

# Retain the newest 30 daily pairs. A first-of-month snapshot is also copied
# to a monthly name so 12 longer-term restore points can be kept separately.
daily = sorted(BACKUPS.glob('????-??-??-budget.db'), reverse=True)
for old_db in daily[30:]:
    old_json = old_db.with_suffix('.json')
    old_db.unlink(missing_ok=True); old_json.unlink(missing_ok=True)

if date.today().day == 1:
    month = date.today().strftime('%Y-%m')
    monthly_db = BACKUPS / f'monthly-{month}-budget.db'
    monthly_json = BACKUPS / f'monthly-{month}-budget.json'
    monthly_db.write_bytes(sqlite_path.read_bytes())
    monthly_json.write_bytes(json_path.read_bytes())
    monthly = sorted(BACKUPS.glob('monthly-????-??-budget.db'), reverse=True)
    for old_db in monthly[12:]:
        old_json = old_db.with_suffix('.json')
        old_db.unlink(missing_ok=True); old_json.unlink(missing_ok=True)

print(f'Backup complete: {sqlite_path.name}, {json_path.name}')
