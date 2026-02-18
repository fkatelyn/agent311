---
name: analyze-311-data
description: >
  Use when the user asks to "analyze 311 data", "explore 311 data",
  "311 insights", "311 statistics", "311 trends", "what's interesting in 311",
  "show 311 charts", "311 bar chart", "311 report", or discusses analyzing,
  exploring, or visualizing Austin 311 service request data.
version: 1.0.0
---

# Analyze Austin 311 Data

Run exploratory analysis on local Austin 311 CSV data and present findings with ASCII visualizations.

## Prerequisites

A 311 data CSV must exist in the `data/` directory (e.g., `data/austin_311_data.csv` or `data/austin_311_last_month.csv`). If no file exists, tell the user to run `/download-311-data` first.

## Steps

### 1. Find the Data File

Look for CSV files in `data/` containing `311` in the name. If multiple exist, use the largest or ask the user which one.

### 2. Run the Analysis

Execute the following Python script with `uv run python3`, adapting the filename as needed:

```python
import csv
from collections import Counter
from datetime import datetime, timedelta

FILENAME = 'data/austin_311_last_month.csv'  # adjust to actual file

with open(FILENAME, 'r') as f:
    rows = list(csv.DictReader(f))

def parse_date(d):
    try: return datetime.strptime(d[:19], '%Y-%m-%dT%H:%M:%S')
    except: return None

print(f"Total requests: {len(rows)}\n")

# --- Top 15 request types ---
types = Counter(r['sr_type_desc'] for r in rows)
print("=== TOP 15 REQUEST TYPES ===")
for t, c in types.most_common(15):
    print(f"  {c:>5}  {t}")

# --- By department ---
depts = Counter(r['sr_department_desc'] for r in rows)
print("\n=== BY DEPARTMENT ===")
for d, c in depts.most_common():
    print(f"  {c:>5}  {d}")

# --- Status breakdown ---
statuses = Counter(r['sr_status_desc'] for r in rows)
print("\n=== STATUS ===")
for s, c in statuses.most_common():
    print(f"  {c:>5}  {s}")

# --- How reported ---
methods = Counter(r['sr_method_received_desc'] for r in rows)
print("\n=== HOW REPORTED ===")
for m, c in methods.most_common():
    print(f"  {c:>5}  {m}")

# --- Temporal patterns ---
days = Counter()
hours = Counter()
daily_counts = Counter()
for r in rows:
    dt = parse_date(r['sr_created_date'])
    if dt:
        days[dt.strftime('%A')] += 1
        hours[dt.hour] += 1
        daily_counts[dt.strftime('%Y-%m-%d')] += 1

print("\n=== BY DAY OF WEEK ===")
for d in ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']:
    print(f"  {days[d]:>5}  {d}")

print("\n=== BY HOUR OF DAY ===")
for h in sorted(hours.keys()):
    bar = '#' * (hours[h] // 40)
    print(f"  {h:>2}:00  {hours[h]:>5}  {bar}")

# --- Busiest / quietest days ---
print("\n=== BUSIEST DAYS ===")
for d, c in daily_counts.most_common(5):
    print(f"  {c:>5}  {d}")
print("\n=== QUIETEST DAYS ===")
for d, c in sorted(daily_counts.items(), key=lambda x: x[1])[:5]:
    print(f"  {c:>5}  {d}")

# --- Top ZIP codes ---
zips = Counter(r['sr_location_zip_code'] for r in rows if r['sr_location_zip_code'])
print("\n=== TOP 10 ZIP CODES ===")
for z, c in zips.most_common(10):
    print(f"  {c:>5}  {z}")

# --- Council districts ---
districts = Counter(r['sr_location_council_district'] for r in rows if r['sr_location_council_district'])
print("\n=== BY COUNCIL DISTRICT ===")
for d, c in sorted(districts.items(), key=lambda x: -x[1]):
    print(f"  {c:>5}  District {d}")

# --- Resolution time ---
resolution_times = []
for r in rows:
    if r['sr_status_desc'] == 'Closed' and r['sr_created_date'] and r['sr_closed_date']:
        created = parse_date(r['sr_created_date'])
        closed = parse_date(r['sr_closed_date'])
        if created and closed and closed >= created:
            resolution_times.append((closed - created).total_seconds() / 3600)

print(f"\n=== RESOLUTION TIME (closed requests) ===")
print(f"  Total closed: {len(resolution_times)}")
if resolution_times:
    avg = sum(resolution_times) / len(resolution_times)
    resolution_times.sort()
    median = resolution_times[len(resolution_times)//2]
    print(f"  Avg resolution: {avg:.1f} hours ({avg/24:.1f} days)")
    print(f"  Median resolution: {median:.1f} hours ({median/24:.1f} days)")
    print(f"  Fastest: {resolution_times[0]:.2f} hours")
    print(f"  Slowest: {resolution_times[-1]:.1f} hours ({resolution_times[-1]/24:.0f} days)")

    # Resolution by type (top 10)
    print("\n=== AVG RESOLUTION BY TYPE (top 10 types) ===")
    type_res = {}
    for r in rows:
        if r['sr_status_desc'] == 'Closed' and r['sr_created_date'] and r['sr_closed_date']:
            created = parse_date(r['sr_created_date'])
            closed = parse_date(r['sr_closed_date'])
            if created and closed and closed >= created:
                t = r['sr_type_desc']
                type_res.setdefault(t, []).append((closed - created).total_seconds() / 3600)
    top_types = [t for t, _ in types.most_common(10)]
    for t in top_types:
        if t in type_res:
            vals = type_res[t]
            avg_t = sum(vals) / len(vals)
            vals.sort()
            med_t = vals[len(vals)//2]
            print(f"  {avg_t:>7.1f}h avg | {med_t:>6.1f}h med  {t} (n={len(vals)})")

# --- Still open requests ---
open_reqs = [r for r in rows if r['sr_status_desc'] != 'Closed']
open_types = Counter(r['sr_type_desc'] for r in open_reqs)
print(f"\n=== STILL OPEN - BY TYPE ===")
print(f"  Total open: {len(open_reqs)}")
for t, c in open_types.most_common(10):
    print(f"  {c:>5}  {t}")

# --- Oldest open requests ---
print("\n=== OLDEST STILL-OPEN REQUESTS ===")
open_with_dates = [(r, parse_date(r['sr_created_date'])) for r in open_reqs]
open_with_dates = [(r, d) for r, d in open_with_dates if d]
open_with_dates.sort(key=lambda x: x[1])
now = datetime.now()
for r, d in open_with_dates[:5]:
    age = (now - d).days
    print(f"  {age:>3} days old  {r['sr_type_desc']}  ({r['sr_number']})")
```

### 3. Daily Bar Chart (Past 7 Days)

After the main analysis, generate an ASCII bar chart of the past 7 days:

```python
from datetime import datetime, timedelta

today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
start = today - timedelta(days=6)

daily = Counter()
for r in rows:
    dt = parse_date(r['sr_created_date'])
    if dt and start <= dt:
        daily[dt.strftime('%Y-%m-%d')] += 1

chart_days = []
for i in range(7):
    d = start + timedelta(days=i)
    key = d.strftime('%Y-%m-%d')
    label = d.strftime('%a %m/%d')
    chart_days.append((key, label, daily.get(key, 0)))

max_count = max((c for _, _, c in chart_days), default=1)
bar_width = 50

print("\n  Austin 311 Requests — Past 7 Days")
print("  " + "=" * 58)
print()
for key, label, count in chart_days:
    filled = int((count / max_count) * bar_width) if max_count > 0 else 0
    bar = '█' * filled
    print(f"  {label}  {bar} {count}")
print()
print(f"  Total: {sum(c for _, _, c in chart_days):,} requests")
```

### 4. Summarize Key Findings

After running the analysis, write a summary highlighting the most interesting findings. Focus on:

- **Volume:** What are the most common request types?
- **Performance:** Which types resolve fastest/slowest? What's the open rate?
- **Geography:** Which ZIPs and districts generate the most requests?
- **Timing:** What day/hour patterns exist? Any anomalous days?
- **Backlogs:** Which categories have the most still-open requests?

Present these as a numbered list of key takeaways, with specific numbers.
