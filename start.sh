#!/bin/bash
set -e

# Install uv if not already available
if ! command -v uv &> /dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

cd agent311
uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
