# Personal Budget Tracker V1

A private, mobile-first expense tracker designed for a Raspberry Pi. The interaction is intentionally simple: **open → amount → category → add**.

## Included in V1

- Quick spending entry with iPhone-friendly numeric input.
- Custom categories with icon + color.
- Used categories are archived rather than deleted, preserving all historical records.
- Day / week / month / year spending views.
- Category bar charts.
- Monthly cumulative trajectory compared with the average of up to six previous months.
- Basic month-end projection once enough historical data exists.
- Recurring payments with weekly, monthly, or yearly cadence.
- Planned one-off future payments.
- `Mark paid` converts an expected payment into a real transaction.
- Transaction history with edit and delete.
- JSON export.
- SQLite database using integer sen, not floating-point currency values.
- Installable PWA / iPhone Home Screen mode.
- Daily safe SQLite snapshot + JSON backup.
- 30 daily restore points and 12 first-of-month restore points.
- Raspberry Pi systemd service and timer files.
- Runs entirely without frontend CDN dependencies.

## Deliberately not in V1

- Bank integrations or account syncing.
- Public internet exposure/login system.
- Income/net-worth accounting.
- Envelope budgeting.
- Shared/multi-user accounts.
- Automatic merchant recognition.

Those can be added later without replacing the core transaction schema.

## Project structure

```text
budget-tracker/
├── app.py
├── requirements.txt
├── install_pi.sh
├── data/
│   └── budget.db             # created automatically; gitignored
├── backups/                  # generated backups; gitignored
├── templates/
│   └── index.html
├── static/
│   ├── app.js
│   ├── style.css
│   ├── app-icon.png
│   ├── manifest.webmanifest
│   └── sw.js
├── scripts/
│   └── backup.py
└── systemd/
    ├── budget-tracker.service
    ├── budget-backup.service
    └── budget-backup.timer
```

## Local development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:5055
```

The database is initialized automatically on first launch.

## Raspberry Pi installation

The supplied service files assume:

```text
Linux user: faiz
App path:   /home/faiz/budget-tracker
Port:       5055
```

Copy the extracted folder to `/home/faiz/budget-tracker`, then:

```bash
cd ~/budget-tracker
chmod +x install_pi.sh scripts/backup.py
./install_pi.sh
```

Check it:

```bash
sudo systemctl status budget-tracker --no-pager
systemctl list-timers budget-backup.timer
curl http://127.0.0.1:5055/api/health
```

## Access on home Wi-Fi

Because Flask binds to `0.0.0.0:5055`, browse to the Pi's LAN address:

```text
http://<PI-LAN-IP>:5055
```

## Access away from home with Tailscale

Keep the Pi and iPhone on the same private Tailscale network. No public port-forward is required.

Use either the Pi's Tailscale IP:

```text
http://<PI-TAILSCALE-IP>:5055
```

or its MagicDNS hostname if enabled:

```text
http://<PI-HOSTNAME>:5055
```

V1 assumes this private-network boundary and therefore does **not** contain an internet-facing username/password system.

## Backup behavior

`budget-backup.timer` runs each day at approximately **03:25**.

Each run creates both:

```text
backups/YYYY-MM-DD-budget.db
backups/YYYY-MM-DD-budget.json
```

The database copy uses SQLite's backup API, so it remains safe even if the app is running.

On the first day of each month it also creates:

```text
backups/monthly-YYYY-MM-budget.db
backups/monthly-YYYY-MM-budget.json
```

Retention:

- newest 30 daily backups
- newest 12 monthly backups

Run a manual backup at any time:

```bash
cd ~/budget-tracker
.venv/bin/python scripts/backup.py
```

## Updating the app later

Data is separate from application code in:

```text
data/budget.db
```

So replacing `app.py`, `templates/`, or `static/` does not erase existing spending data.

Before any major update:

```bash
cd ~/budget-tracker
.venv/bin/python scripts/backup.py
```

then restart after copying the new code:

```bash
sudo systemctl restart budget-tracker
```

## Category deletion rule

If a category has **never** been referenced, archive/delete removes it completely.

If it has been used by any transaction, recurring item, or planned payment, the API converts deletion into **archive** instead. Archived categories disappear from Quick Add but remain attached to historic records and reports.

## Data model

Money is stored as integer sen:

```text
RM 12.50 → 1250
```

Core tables:

- `transactions`
- `categories`
- `recurring`
- `planned`

A recurring/planned payment does not count as spending until `Mark paid` creates a transaction.
