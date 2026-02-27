"""Download and update Austin 311 data with delta merge support."""

import os
import urllib.parse
from datetime import datetime
from pathlib import Path

import pandas as pd

API_URL = "https://data.austintexas.gov/resource/xwdj-i9he.csv"
LIMIT = 100000


def get_data_dir() -> Path:
    volume = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
    if volume:
        return Path(volume)
    return Path(__file__).resolve().parent.parent / "data"


def download(where_clause: str, label: str = "") -> pd.DataFrame:
    """Download rows from Socrata API with automatic pagination."""
    frames = []
    offset = 0
    while True:
        params = urllib.parse.urlencode({
            "$where": where_clause,
            "$order": "sr_created_date DESC",
            "$limit": LIMIT,
            "$offset": offset,
        })
        url = f"{API_URL}?{params}"
        print(f"  Fetching {label} offset={offset}...", flush=True)
        df = pd.read_csv(url)
        if df.empty:
            break
        frames.append(df)
        if len(df) < LIMIT:
            break
        offset += LIMIT
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def main():
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    csv_path = data_dir / "311_recent.csv"

    last_year = datetime.now().year - 1
    start_date = f"{last_year}-01-01T00:00:00"

    print(f"311 data file: {csv_path}")

    if csv_path.exists() and csv_path.stat().st_size > 0:
        # Delta update: fetch only new rows and merge
        existing = pd.read_csv(csv_path)
        latest = existing["sr_created_date"].dropna().max()

        if pd.isna(latest):
            print("Cannot determine latest date, re-downloading...")
            df = download(f"sr_created_date>='{start_date}'", "full")
            df.to_csv(csv_path, index=False)
            print(f"Downloaded {len(df)} rows")
        else:
            print(f"Latest existing record: {latest}")
            delta = download(f"sr_created_date>'{latest}'", "delta")
            if delta.empty:
                print("No new records since last update.")
            else:
                merged = pd.concat([delta, existing]).drop_duplicates(
                    subset="sr_number", keep="first"
                )
                merged = merged.sort_values("sr_created_date", ascending=False)
                merged.to_csv(csv_path, index=False)
                new_count = len(merged) - len(existing)
                print(f"Added {new_count} new rows -> {len(merged)} total")
    else:
        # Full download from Jan 1 of last year
        print(f"Downloading since {start_date}...")
        df = download(f"sr_created_date>='{start_date}'", "full")
        df.to_csv(csv_path, index=False)
        print(f"Downloaded {len(df)} rows")


if __name__ == "__main__":
    main()
