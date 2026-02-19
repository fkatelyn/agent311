# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

agent311 is an Austin 311 Data Science Agent — a full-stack application with a FastAPI backend and Next.js frontend, designed to interact with Austin 311 service request data using AI capabilities.

## Tech Stack

- **Backend:** FastAPI + Claude Agent SDK (`claude-agent-sdk`)
- **Frontend:** Next.js 16 + AI Elements + Streamdown (custom SSE streaming)
- **Database:** PostgreSQL (sessions + messages, via SQLAlchemy async ORM + asyncpg)
- **Auth:** JWT (HS256, 7-day expiry, single hardcoded user)
- **Package Manager:** uv (Python), npm (JavaScript)
- **Deployment:** Railway (Nixpacks builder)

## Architecture

### Backend (`agent311/`)
- Self-contained backend directory with its own `pyproject.toml`, `uv.lock`, `nixpacks.toml`, `railway.json`, and `start.sh`
- Python package: `agent311/agent311/` — contains `main.py`, `auth.py`, `db.py`
- Entry point: `agent311/agent311/main.py` — FastAPI app with CORS-enabled streaming chat endpoint
- Chat endpoint: `POST /api/chat` — accepts messages array + optional session_id, returns SSE stream in Vercel AI SDK v6 protocol format
- Must be imported as `agent311.main:app` (package-qualified import)

### Frontend (`agentui/`)
- Next.js 16 with App Router, Tailwind CSS 4, shadcn/ui
- Uses AI Elements components for chat UI primitives (Message, PromptInput, Artifact, CodeBlock, JSXPreview)
- Streamdown for markdown + syntax highlighting + mermaid + math rendering
- Custom SSE parsing via raw `fetch` + `ReadableStream` (does NOT use AI SDK `useChat` hook)
- JWT auth stored in localStorage; auto-redirects to `/login` on 401
- Sessions and messages persisted to backend PostgreSQL (not localStorage)
- Backend URL configured via `NEXT_PUBLIC_API_URL` env var

### Deployment (Railway)
- Two separate Railway services: one for backend (`agent311/`), one for frontend (`agentui/`)
- Backend Root Directory set to `/agent311` in Railway dashboard
- Backend uses `agent311/nixpacks.toml` with `NIXPACKS_UV_VERSION=0.10.0`
- Frontend uses `agentui/nixpacks.toml` with Node.js provider, `NEXT_PUBLIC_API_URL` set to production backend URL
- Railway auto-detects uv via `agent311/pyproject.toml` + `agent311/uv.lock`
- Start command: `bash start.sh` (downloads 311 data, starts uvicorn)

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
cd agentui

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run start
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
- `agent311/nixpacks.toml` — Backend Railway config (uv version, system packages, Claude Code CLI install)
- `agent311/railway.json` — Specifies Nixpacks builder with config path
- `agent311/start.sh` — Startup script (downloads 311 data, starts uvicorn)
- `agent311/.python-version` — Pins Python 3.12
- `agent311/agent311/main.py` — FastAPI app, all endpoints, SSE streaming, MCP tools
- `agent311/agent311/db.py` — SQLAlchemy async ORM, PostgreSQL config, Session/Message models
- `agent311/agent311/auth.py` — JWT auth (create_token, get_current_user)
- `agentui/nixpacks.toml` — Frontend Railway config (Node.js provider, build/start commands)
- `agentui/components/chat.tsx` — Main chat orchestrator (SSE, state, layout, view_content fetch)
- `agentui/components/chat-messages.tsx` — Message rendering, tool summary, artifact cards
- `agentui/components/sidebar.tsx` — Session list, favorites, delete with confirmation
- `agentui/components/artifact-panel.tsx` — Preview panel (iframe for HTML, JSXPreview for JSX)
- `agentui/lib/session-api.ts` — Backend session CRUD API calls
- `agentui/lib/auth.ts` — JWT login, token storage, authFetch wrapper

## Environment Variables

This project uses a `~/.env` file (not checked into git) to store local credentials:

**`~/.env` file contains:**
- `RAILWAY_TOKEN` - For Railway CLI deployments
  - Get from: `railway login --browserless` or https://railway.app/account/tokens
  - **Warning:** If `RAILWAY_TOKEN` is set as an env var, it overrides the CLI session token. If the token is expired, Railway CLI/MCP will fail even if `railway login` works. Fix: `unset RAILWAY_TOKEN`
- `ANTHROPIC_API_KEY` - For Claude Agent SDK integration
  - Get from: https://console.anthropic.com/settings/keys
- `GITHUB_TOKEN` - For GitHub API access (optional)
  - Get from: https://github.com/settings/tokens

**Backend env vars (set in Railway dashboard):**
- `DATABASE_URL` — PostgreSQL connection string (provided automatically by Railway Postgres plugin)
- `JWT_SECRET` — Secret key for JWT signing
- `ANTHROPIC_API_KEY` — Claude API key

**Frontend env var:**
- `NEXT_PUBLIC_API_URL` — Backend API URL (e.g., `https://agent311-production.up.railway.app`)

**Railway MCP Note:** The Railway MCP server may need `RAILWAY_TOKEN` to authenticate. If MCP tools return "Invalid or expired token", check `~/.env` for the current token value, or run `unset RAILWAY_TOKEN` to fall back to the CLI session token from `railway login`.

The `~/.env` file should never be committed to git.

## Important Notes

- Backend must be run using `python -m uvicorn` (not bare `uvicorn`) to avoid PATH issues on Railway
- Frontend uses custom SSE parsing, not AI SDK `useChat` hook
- Backend streams messages using Vercel AI SDK v6 SSE protocol (`start`, `text-start`, `text-delta`, `text-end`, `finish`, `[DONE]`)
- Tool invocations are emitted as `text-delta` markers: `[Using tool: Read]`, `[Using tool: view_content /tmp/file.html]`
- `view_content` is a custom MCP tool that lets the agent expose a file for frontend preview
- File preview is restricted to `/tmp/` only, max 200KB, allowed extensions: `.html`, `.js`, `.jsx`, `.tsx`
- CORS is wide-open (`*`) for development; should be restricted in production
- Railway backend service Root Directory must be set to `/agent311`
- Railway containers run as root — use `permission_mode="acceptEdits"` not `"bypassPermissions"`
- Hardcoded auth credentials: `default@agentaustin.org` / `password` (single-user app)
- DB tables (`sessions`, `messages`) are created automatically on startup; `is_favorite` column added via migration guard if missing
