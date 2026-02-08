# CLAUDE.md

## Project Overview

agent311 is an Austin 311 Data Science Agent. It uses Claude SDK to power an AI agent that interacts with Austin 311 data.

## Tech Stack

- **Backend:** FastAPI (Python) + Claude Code SDK (`claude-code-sdk`)
- **Frontend:** React / JavaScript with Vercel AI Chat SDK (`ai` package)
- **Deployment:** Railway (both backend and frontend services)
- **Package Manager:** uv (Python)

## Backend

- Entry point: `agent311/main.py`
- Dependencies defined in: `agent311/pyproject.toml`
- Run locally: `cd agent311 && uv run uvicorn main:app --host 0.0.0.0 --port 8000`
- Railway startup: `start.sh` (installs uv, then launches uvicorn)

## Development Notes

- FastAPI serves the API backend; the React frontend communicates with it via HTTP/streaming endpoints
- Vercel AI Chat SDK (`useChat` hook) on the frontend handles streaming responses from the FastAPI backend
- Railway runs the backend and frontend as separate services
- The `start.sh` script installs uv at deploy time if not present, then starts the FastAPI server
