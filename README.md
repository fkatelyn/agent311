# agent311

Austin 311 Data Science Agent — a full-stack application for exploring Austin 311 service request data using AI.

## Architecture

- **Backend:** FastAPI + Claude Agent SDK (streaming chat, JWT auth, PostgreSQL persistence)
- **Frontend:** Next.js 16 + AI Elements + Streamdown (markdown, syntax highlighting, artifact preview)
- **Database:** PostgreSQL (chat sessions + messages)
- **Package Manager:** uv (Python), npm (JavaScript)
- **Deployment:** Railway (Nixpacks builder)

The backend exposes a `/api/chat` endpoint that streams AI responses using Server-Sent Events (SSE) in Vercel AI SDK v6 format. The frontend connects to the backend via JWT-authenticated requests and renders responses with live markdown streaming.

## Quick Start

### Backend (FastAPI)

```bash
cd agent311

# Set environment variables
export ANTHROPIC_API_KEY=sk-ant-...
export DATABASE_URL=postgresql://...
export JWT_SECRET=your-secret-key

# Run dev server
uv run uvicorn agent311.main:app --reload --host 0.0.0.0 --port 8000
```

API available at http://localhost:8000

### Frontend (Next.js)

```bash
cd agentui
npm install
npm run dev
```

Available at http://localhost:3000. Log in with `default@agentaustin.org` / `password`.

## Project Structure

```
agent311/
├── agent311/              # Backend Python package
│   ├── agent311/
│   │   ├── main.py        # FastAPI app, all endpoints, SSE streaming, MCP tools
│   │   ├── db.py          # SQLAlchemy async ORM, Session/Message models
│   │   └── auth.py        # JWT authentication
│   ├── .claude/
│   │   └── skills/        # Claude Code skills (download-311-data, analyze-311-data, visualize, etc.)
│   ├── pyproject.toml     # Python dependencies (uv)
│   ├── nixpacks.toml      # Railway build config
│   ├── railway.json       # Railway builder config
│   └── start.sh           # Startup: download 311 data → start uvicorn
├── agentui/               # Next.js frontend
│   ├── app/
│   │   ├── page.tsx       # Chat page
│   │   └── login/         # Login page
│   ├── components/
│   │   ├── chat.tsx           # Main orchestrator (SSE, state, layout)
│   │   ├── chat-messages.tsx  # Message rendering + tool summary + artifact cards
│   │   ├── sidebar.tsx        # Session list, favorites, delete
│   │   ├── artifact-panel.tsx # Preview panel (iframe/JSX + resizable)
│   │   ├── chat-input.tsx     # PromptInput wrapper
│   │   └── ai-elements/       # AI Elements components (Message, PromptInput, etc.)
│   ├── lib/
│   │   ├── session-api.ts     # Backend session CRUD API calls
│   │   ├── auth.ts            # JWT login + authFetch wrapper
│   │   ├── config.ts          # API_URL config
│   │   └── types.ts           # ChatMessage type
│   ├── nixpacks.toml          # Railway build config
│   └── package.json
├── docs/                  # Documentation
│   ├── agentui-frontend.md          # Frontend architecture guide
│   ├── agent-sdk-guide.md           # Claude Agent SDK integration
│   ├── view-content-artifact-viewer.md  # Artifact preview design
│   ├── railway-deployment-guide.md  # Complete Railway deployment guide
│   └── ...
├── CLAUDE.md              # Development guidelines
└── README.md
```

## Features

- **Streaming AI chat** — Claude Agent SDK with real-time SSE streaming
- **Artifact preview** — Agent writes HTML/JSX to `/tmp/`, frontend renders it in a split panel
- **Session persistence** — Chat history stored in PostgreSQL with title, favorites, delete
- **JWT auth** — Token-based login (single-user, hardcoded credentials)
- **Built-in tools** — Read, Write, Edit, Bash, WebSearch, WebFetch, Task
- **Skills** — Filesystem skills for downloading, analyzing, and visualizing Austin 311 data

## Deployment

Two Railway services in a monorepo:

**Backend service (`agent311/`):**
- Root Directory: `/agent311` (set in Railway dashboard)
- Nixpacks auto-detects uv via `pyproject.toml` + `uv.lock`
- Installs Claude Code CLI at build time (`npm install -g @anthropic-ai/claude-code`)
- Start: `bash start.sh` (downloads fresh 311 data, starts uvicorn)
- Required env vars: `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`

**Frontend service (`agentui/`):**
- Root Directory: `/agentui` (set in Railway dashboard)
- Nixpacks Node.js provider, builds with `npm run build`
- Required env var: `NEXT_PUBLIC_API_URL` (backend URL)

See [docs/railway-deployment-guide.md](docs/railway-deployment-guide.md) for full instructions.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Get JWT token |
| `POST` | `/api/chat` | Stream chat response (SSE) |
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions` | Create session |
| `GET` | `/api/sessions/{id}` | Get session with messages |
| `PATCH` | `/api/sessions/{id}` | Update title or favorite |
| `DELETE` | `/api/sessions/{id}` | Delete session |
| `GET` | `/api/fetch_file` | Fetch file for preview (restricted to `/tmp/`) |

### `POST /api/chat`

**Request:**
```json
{
  "messages": [{ "role": "user", "content": "What's the top 311 complaint in Austin?" }],
  "session_id": "uuid"
}
```

**Response:** SSE stream
```
data: {"type":"start","messageId":"..."}
data: {"type":"text-start","id":"..."}
data: {"type":"text-delta","id":"...","delta":"The top complaint is..."}
data: {"type":"text-end","id":"..."}
data: {"type":"finish"}
data: [DONE]
```

## Documentation

- **[Frontend Architecture](docs/agentui-frontend.md)** — Component breakdown, SSE parsing, artifact preview
- **[Claude Agent SDK Guide](docs/agent-sdk-guide.md)** — SDK integration, skills, custom MCP tools, Railway gotchas
- **[View Content Artifact Viewer](docs/view-content-artifact-viewer.md)** — How the agent exposes files for frontend preview
- **[Railway Deployment Guide](docs/railway-deployment-guide.md)** — Complete guide for deploying on Railway
- **[Railway FastAPI Setup](docs/railway-fastapi-setup.md)** — FastAPI + uv deployment walkthrough
- **[Railway Next.js](docs/railway-nextjs-assistantui.md)** — Next.js deployment pitfalls
- **[Git and GitHub CLI Guide](docs/git-and-gh-guide.md)** — Practical git + gh CLI reference

## Austin 311 Data Source

Austin 311 service request data is available through the **City of Austin Open Data Portal** powered by Socrata.

### What is Austin 311?

**Austin 311** is the City of Austin's non-emergency service request system. Residents use it to report issues, request city services, and get information about city programs.

**How to Use 311:**
- **Phone:** Call 3-1-1 (or 512-974-2000 from outside Austin)
- **Web:** https://311.austin.gov
- **Mobile App:** Austin 311 (iOS/Android)

### Data API

- **Dataset:** [311 Unified Data](https://data.austintexas.gov/City-Government/311-Unified-Data/i26j-ai4z)
- **API Endpoint:** `https://data.austintexas.gov/resource/i26j-ai4z.json`
- **Format:** JSON via Socrata Open Data API (SODA)
- **Size:** ~7.8M rows (2014–present, updated daily)

### Dataset Schema

```
service_request_sr_number    # Unique SR ID (e.g., 24-00123456)
sr_type_code                 # Service request type
sr_description               # Free-text description
method_received              # Phone, Web, Mobile, etc.
sr_status                    # New, Closed, Duplicate
created_date                 # Request creation timestamp
close_date                   # Resolution timestamp
sr_location                  # Address or intersection
latitude / longitude         # Geocoded coordinates
council_district             # City council district (1-10)
```

### Service Request Categories

| Category | Example Services | Volume |
|----------|-----------------|--------|
| **Code Compliance** | Overgrown vegetation, junk vehicles, illegal dumping | ~25% |
| **Austin Resource Recovery** | Missed collection, recycling, bulk items | ~20% |
| **Transportation & Public Works** | Potholes, street lights, traffic signals | ~15% |
| **Animal Services** | Stray animals, wildlife, barking dogs | ~10% |
| **Austin Water** | Water leaks, pressure issues, billing | ~8% |
| **Other** | Parks, libraries, health, development | ~22% |

### API Usage Example

```bash
# Get recent 311 requests (last 7 days)
curl "https://data.austintexas.gov/resource/i26j-ai4z.json?\$where=created_date>='2024-01-01'&\$limit=100"

# Get potholes by council district
curl "https://data.austintexas.gov/resource/i26j-ai4z.json?sr_type_code=POTHOLE&council_district=5"
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, uvicorn |
| AI | Claude Agent SDK, Claude Code CLI |
| Database | PostgreSQL, SQLAlchemy async, asyncpg |
| Auth | JWT (PyJWT, HS256) |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| UI | AI Elements, shadcn/ui, Streamdown |
| Deployment | Railway, Nixpacks |
| Package mgmt | uv (Python), npm (JavaScript) |

## License

MIT
