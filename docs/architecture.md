# Architecture

agent311 is a full-stack app: a FastAPI backend that runs a Claude AI agent, and a Next.js frontend for the chat UI.

## Stack

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

## How It Works

The backend exposes a `/api/chat` endpoint that streams AI responses using Server-Sent Events (SSE) in Vercel AI SDK v6 format. The frontend connects via JWT-authenticated requests and renders responses with live markdown streaming.

Tool invocations are emitted as `text-delta` markers: `[Using tool: Read]`, `[Using tool: view_content /tmp/file.html]`. The `view_content` MCP tool lets the agent expose a file for frontend preview (restricted to `/tmp/`, max 200KB, `.html`/`.js`/`.jsx`/`.tsx` only).

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
└── docs/
```

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

## Austin 311 Dataset

Data comes from the **City of Austin Open Data Portal** via Socrata.

- **Dataset:** [311 Unified Data](https://data.austintexas.gov/City-Government/311-Unified-Data/i26j-ai4z)
- **API Endpoint:** `https://data.austintexas.gov/resource/xwdj-i9he.csv`
- **Size:** ~7.8M rows (2014–present, updated daily)
- **No API key required** for reasonable request volumes

### Schema

```
sr_number                    # Unique service request ID
sr_type_desc                 # Request type (e.g., "ARR - Garbage")
sr_department_desc           # Responsible city department
sr_method_received_desc      # How reported (Phone, App, Web)
sr_status_desc               # Status (Open, Closed, Duplicate)
sr_created_date              # When the request was filed
sr_closed_date               # When the request was closed
sr_location                  # Full address string
sr_location_zip_code         # ZIP code
sr_location_council_district # City council district (1–10)
sr_location_lat / _long      # Geocoded coordinates
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

### Example API Queries

```bash
# Get recent 311 requests
curl "https://data.austintexas.gov/resource/xwdj-i9he.csv?\$where=sr_created_date>='2026-01-01T00:00:00'&\$limit=50000"

# Filter by department
curl "https://data.austintexas.gov/resource/xwdj-i9he.csv?\$where=sr_department_desc='Austin Resource Recovery'"

# Filter by ZIP code
curl "https://data.austintexas.gov/resource/xwdj-i9he.csv?\$where=sr_location_zip_code='78704'"
```
