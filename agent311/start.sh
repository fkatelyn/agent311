#!/bin/bash
set -e

# Download Austin 311 data from this year on startup
YEAR_START="$(date -u +%Y)-01-01T00:00:00"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-$SCRIPT_DIR/data}"
mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/311_recent.csv" ]; then
  echo "Downloading Austin 311 data since $YEAR_START..."
  curl -s -o "$DATA_DIR/311_recent.csv" \
    "https://data.austintexas.gov/resource/xwdj-i9he.csv?\$where=sr_created_date%20>=%20'${YEAR_START}'&\$order=sr_created_date%20DESC&\$limit=100000"
  ROWS=$(wc -l < "$DATA_DIR/311_recent.csv" | tr -d ' ')
  echo "Downloaded $ROWS rows to $DATA_DIR/311_recent.csv"
else
  echo "311 data already present at $DATA_DIR/311_recent.csv, skipping download."
fi

uv run uvicorn agent311.main:app --host 0.0.0.0 --port ${PORT:-8000}
