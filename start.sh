#!/bin/bash
set -e

# Download past 7 days of Austin 311 data on startup
SEVEN_DAYS_AGO=$(date -u -d "7 days ago" +%Y-%m-%dT00:00:00 2>/dev/null || date -u -v-7d +%Y-%m-%dT00:00:00)
DATA_DIR="/tmp/agent311_data"
mkdir -p "$DATA_DIR"

echo "Downloading Austin 311 data since $SEVEN_DAYS_AGO..."
curl -s -o "$DATA_DIR/311_recent.csv" \
  "https://data.austintexas.gov/resource/xwdj-i9he.csv?\$where=sr_created_date%20>=%20'${SEVEN_DAYS_AGO}'&\$order=sr_created_date%20DESC&\$limit=50000"

ROWS=$(wc -l < "$DATA_DIR/311_recent.csv" | tr -d ' ')
echo "Downloaded $ROWS rows to $DATA_DIR/311_recent.csv"

python -m uvicorn agent311.main:app --host 0.0.0.0 --port ${PORT:-8000}
