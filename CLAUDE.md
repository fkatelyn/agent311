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
- Self-contained backend directory with its own `pyproject.toml`, `uv.lock`, `nixpacks.toml`, `railway.json`, and `start.sh`
- Python package: `agent311/agent311/` — contains `main.py` and `__init__.py`
- Entry point: `agent311/agent311/main.py` — FastAPI app with CORS-enabled streaming chat endpoint
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
- Backend Root Directory set to `/agent311` in Railway dashboard
- Backend uses `agent311/nixpacks.toml` with `NIXPACKS_UV_VERSION=0.10.0`
- Frontend uses `frontend/nixpacks.toml` with build command `npm install && npm run build`
- Railway auto-detects uv via `agent311/pyproject.toml` + `agent311/uv.lock`
- Start command: `bash start.sh` (which runs `python -m uvicorn agent311.main:app`)

## Development Commands

### Backend

```bash
cd agent311

# Run FastAPI dev server
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
- **Do not `git push`** unless the user explicitly asks to push or deploy to Railway. Commits are local-only by default.

## Key Files

- `agent311/pyproject.toml` + `agent311/uv.lock` — Python dependencies
- `agent311/nixpacks.toml` — Backend Railway config (uv version, system packages, start command)
- `agent311/railway.json` — Specifies Nixpacks builder with config path
- `agent311/start.sh` — Startup script (downloads 311 data, starts uvicorn)
- `agent311/.python-version` — Pins Python 3.12
- `frontend/nixpacks.toml` — Frontend Railway config (build/start commands, API URL)

## Environment Variables

This project uses a `~/.env` file (not checked into git) to store local credentials:

**`~/.env` file contains:**
- `RAILWAY_TOKEN` - For Railway CLI deployments
  - Get from: `railway login --browserless` or https://railway.app/account/tokens
  - **Warning:** If `RAILWAY_TOKEN` is set as an env var, it overrides the CLI session token. If the token is expired, Railway CLI/MCP will fail even if `railway login` works. Fix: `unset RAILWAY_TOKEN`
- `ANTHROPIC_API_KEY` - For Claude Code SDK integration
  - Get from: https://console.anthropic.com/settings/keys
- `GITHUB_TOKEN` - For GitHub API access (optional)
  - Get from: https://github.com/settings/tokens

**Railway MCP Note:** The Railway MCP server may need `RAILWAY_TOKEN` to authenticate. If MCP tools return "Invalid or expired token", check `~/.env` for the current token value, or run `unset RAILWAY_TOKEN` to fall back to the CLI session token from `railway login`.

The `~/.env` file should never be committed to git.

## Important Notes

- Backend must be run using `python -m uvicorn` (not bare `uvicorn`) to avoid PATH issues on Railway
- Frontend chat uses custom SSE parsing, not AI SDK `useChat` hook
- Backend streams messages using Vercel AI SDK data stream protocol format (types: `start`, `text-start`, `text-delta`, `text-end`, `finish`, `[DONE]`)
- CORS is wide-open (`*`) for development; should be restricted in production
- Railway sets `NIXPACKS_PYTHON_PACKAGE_MANAGER=uv` via dashboard env var
- Railway backend service Root Directory must be set to `/agent311`
