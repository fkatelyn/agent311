#!/bin/bash
set -e

cd agent311
python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
