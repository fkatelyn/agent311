#!/bin/bash
set -e

# Download past 30 days of Austin 311 data on startup
THIRTY_DAYS_AGO=$(date -u -d "30 days ago" +%Y-%m-%dT00:00:00 2>/dev/null || date -u -v-30d +%Y-%m-%dT00:00:00)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-$SCRIPT_DIR/data}"
mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/311_recent.csv" ]; then
  echo "Downloading Austin 311 data since $THIRTY_DAYS_AGO..."
  curl -s -o "$DATA_DIR/311_recent.csv" \
    "https://data.austintexas.gov/resource/xwdj-i9he.csv?\$where=sr_created_date%20>=%20'${THIRTY_DAYS_AGO}'&\$order=sr_created_date%20DESC&\$limit=50000"
  ROWS=$(wc -l < "$DATA_DIR/311_recent.csv" | tr -d ' ')
  echo "Downloaded $ROWS rows to $DATA_DIR/311_recent.csv"
else
  echo "311 data already present at $DATA_DIR/311_recent.csv, skipping download."
fi

uv run uvicorn agent311.main:app --host 0.0.0.0 --port ${PORT:-8000}
