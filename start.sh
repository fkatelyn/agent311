#!/bin/bash
set -e

cd agent311
uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
