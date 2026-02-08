# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

agent311 is an Austin 311 Data Science Agent — a full-stack application with a FastAPI backend and React frontend, designed to interact with Austin 311 service request data using AI capabilities.

## Tech Stack

- **Backend:** FastAPI + Claude Code SDK (`claude-code-sdk`)
- **Frontend:** React + Vite (custom SSE chat implementation)
- **Package Manager:** uv (Python)
- **Deployment:** Railway (Nixpacks builder)

## Architecture

### Backend (`agent311/`)
- Entry point: `agent311/main.py` — FastAPI app with CORS-enabled streaming chat endpoint
- Chat endpoint: `POST /api/chat` — accepts messages array, returns SSE stream in Vercel AI SDK protocol format
- Currently returns dummy responses; designed to integrate Claude Code SDK for real data analysis
- Must be imported as `agent311.main:app` (package-qualified import)

### Frontend (`frontend/`)
- Vite-powered React SPA with custom SSE streaming chat UI
- Does NOT use Vercel AI SDK — implements raw fetch + SSE parsing
- Backend URL configured via `VITE_API_URL` env var (default: `http://localhost:8000`)
- Build output: `frontend/dist/`
- Production server: `npx serve dist`

### Deployment (Railway)
- Two separate Railway services: one for backend, one for frontend
- Backend uses `nixpacks.toml` at repo root with `NIXPACKS_UV_VERSION=0.10.0`
- Frontend uses `frontend/nixpacks.toml` with build command `npm install && npm run build`
- Railway auto-detects uv via root `pyproject.toml` + `uv.lock`
- Start command: `python -m uvicorn agent311.main:app --host 0.0.0.0 --port ${PORT:-8000}`

## Development Commands

### Backend

```bash
# Run FastAPI dev server (from repo root)
uv run uvicorn agent311.main:app --host 0.0.0.0 --port 8000

# Or with auto-reload
uv run uvicorn agent311.main:app --reload --host 0.0.0.0 --port 8000

# Add dependencies
uv add <package>

# Sync dependencies
uv sync
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Git Workflow

- **Commit directly to `main`** — do not create pull requests
- **Commit titles** should be clean, concise, and written naturally (avoid robotic phrasing)
  - Good: "Add chat streaming endpoint"
  - Bad: "feat: implement chat streaming endpoint with SSE protocol support"
- **Commit messages** should be simple and human-readable — explain what changed and why, but keep it conversational
- **Do not add** "Co-Authored-By" or other metadata that makes commits look automated

## Key Files

- `pyproject.toml` + `uv.lock` — Python dependencies (must be at repo root for Nixpacks)
- `nixpacks.toml` — Backend Railway config (uv version, start command)
- `frontend/nixpacks.toml` — Frontend Railway config (build/start commands, API URL)
- `railway.json` — Specifies Nixpacks builder
- `start.sh` — Local convenience script (not used by Railway)
- `.python-version` — Pins Python 3.12

## Important Notes

- Backend must be run using `python -m uvicorn` (not bare `uvicorn`) to avoid PATH issues on Railway
- Frontend chat uses custom SSE parsing, not AI SDK `useChat` hook
- Backend streams messages using Vercel AI SDK data stream protocol format (types: `start`, `text-start`, `text-delta`, `text-end`, `finish`, `[DONE]`)
- CORS is wide-open (`*`) for development; should be restricted in production
- Railway sets `NIXPACKS_PYTHON_PACKAGE_MANAGER=uv` via dashboard env var
