#!/bin/bash
set -e

# Download/update Austin 311 data (Jan 1 of last year to present)
uv run python -m agent311.download_311

uv run uvicorn agent311.main:app --host 0.0.0.0 --port ${PORT:-8000}
