# agent311

Austin 311 Data Science Agent — a full-stack application for exploring Austin 311 service request data using AI.

**Live Demo:**
- **Frontend:** https://agent311-frontend-production.up.railway.app
- **Backend API:** https://agent311-production.up.railway.app

## Architecture

- **Backend:** FastAPI + Claude Code SDK (streaming chat endpoint)
- **Frontend:** React + Vite (custom SSE chat implementation)
- **Package Manager:** uv (Python)
- **Deployment:** Railway (Nixpacks builder)

The backend exposes a `/api/chat` endpoint that streams AI responses using Server-Sent Events (SSE). The frontend implements a custom SSE parser to display streaming chat messages in real-time.

## Quick Start

### Backend (FastAPI)

```bash
# From repo root
uv run uvicorn agent311.main:app --host 0.0.0.0 --port 8000

# Or with auto-reload
uv run uvicorn agent311.main:app --reload --host 0.0.0.0 --port 8000
```

API will be available at http://localhost:8000

### Frontend (React)

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend will be available at http://localhost:5173

## Project Structure

```
agent311/
├── agent311/              # Python backend package
│   ├── __init__.py
│   └── main.py           # FastAPI app with streaming chat endpoint
├── frontend/             # React frontend
│   ├── src/
│   │   ├── App.jsx       # Chat UI with custom SSE streaming
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── nixpacks.toml     # Frontend Railway config
├── docs/                 # Documentation
│   ├── railway-deployment-guide.md
│   └── git-and-gh-guide.md
├── pyproject.toml        # Python deps (must be at root)
├── uv.lock               # uv lockfile (must be at root)
├── nixpacks.toml         # Backend Railway config
├── railway.json          # Railway builder config
├── start.sh              # Local dev startup script
├── CLAUDE.md             # Development guidelines
└── README.md
```

## Development

### Add Python Dependencies

```bash
uv add <package-name>
uv sync
```

### Build Frontend for Production

```bash
cd frontend
npm run build
npm run preview  # Test production build locally
```

## Deployment

This project uses Railway for deployment with separate services for backend and frontend.

**Backend Service:**
- Automatically detected via root `pyproject.toml` + `uv.lock`
- Uses Nixpacks with uv (version pinned in `nixpacks.toml`)
- Start command: `python -m uvicorn agent311.main:app --host 0.0.0.0 --port ${PORT}`

**Frontend Service:**
- Built with `npm install && npm run build`
- Served with `npx serve dist`
- Backend API URL configured via `VITE_API_URL` env var

See [docs/railway-deployment-guide.md](docs/railway-deployment-guide.md) for complete deployment instructions.

## Documentation

- **[Railway Deployment Guide](docs/railway-deployment-guide.md)** - Complete guide for deploying Python/FastAPI, React, and Docker services on Railway
- **[Git and GitHub CLI Guide](docs/git-and-gh-guide.md)** - Practical guide for using git and gh CLI
- **[CLAUDE.md](CLAUDE.md)** - Development context and guidelines for working with this codebase

## Tech Stack

- **Backend:** Python 3.12, FastAPI, uvicorn, Claude Code SDK
- **Frontend:** React 19, Vite 6
- **Deployment:** Railway (Nixpacks)
- **Package Management:** uv (Python), npm (JavaScript)

## Austin 311 Data Source

Austin 311 service request data is available through the **City of Austin Open Data Portal** powered by Socrata.

### Data API

**Austin 311 Unified Dataset:**
- **Portal:** https://data.austintexas.gov
- **Dataset:** [311 Unified Data](https://data.austintexas.gov/City-Government/311-Unified-Data/i26j-ai4z)
- **API Endpoint:** `https://data.austintexas.gov/resource/i26j-ai4z.json`
- **Format:** JSON via Socrata Open Data API (SODA)
- **Size:** ~7.8M rows (2014-present, growing daily)
- **Update Frequency:** Real-time

### Service Request Categories

The dataset includes all 311 service requests across Austin:

| Category | Example Services | Volume |
|----------|-----------------|--------|
| **Code Compliance** | Overgrown vegetation, junk vehicles, illegal dumping | ~25% |
| **Austin Resource Recovery** | Missed collection, recycling, bulk items | ~20% |
| **Transportation & Public Works** | Potholes, street lights, traffic signals | ~15% |
| **Animal Services** | Stray animals, wildlife, barking dogs | ~10% |
| **Austin Water** | Water leaks, pressure issues, billing | ~8% |
| **Other** | Parks, libraries, health, development | ~22% |

### Dataset Schema

Key fields in the 311 dataset:

```
service_request_sr_number    # Unique SR ID (e.g., 24-00123456)
sr_type_code                 # Service request type
sr_description               # Free-text description
method_received              # Phone, Web, Mobile, etc.
sr_status                    # New, Closed, Duplicate
created_date                 # Request creation timestamp
last_update_date             # Last status update
close_date                   # Resolution timestamp
sr_location                  # Address or intersection
latitude / longitude         # Geocoded coordinates
council_district             # City council district (1-10)
```

### API Usage Example

```bash
# Get recent 311 requests (last 7 days)
curl "https://data.austintexas.gov/resource/i26j-ai4z.json?\$where=created_date>='2024-01-01'&\$limit=100"

# Get potholes by council district
curl "https://data.austintexas.gov/resource/i26j-ai4z.json?sr_type_code=POTHOLE&council_district=5"

# Count requests by type
curl "https://data.austintexas.gov/resource/i26j-ai4z.json?\$select=sr_type_code,count(*)&\$group=sr_type_code"
```

### Socrata API Documentation

- **API Docs:** https://dev.socrata.com/foundry/data.austintexas.gov/i26j-ai4z
- **SoQL Query Language:** https://dev.socrata.com/docs/queries/
- **Rate Limits:** 1,000 requests/day (unauthenticated), 100,000/day (with app token)
- **App Token:** Register at https://data.austintexas.gov/profile/app_tokens

### Data Stats (as of 2024)

- **Total Records:** ~7.8 million service requests
- **Date Range:** January 2014 - Present
- **Daily Volume:** ~1,500-2,000 new requests per day
- **Average Response Time:** 3-5 business days (varies by department)
- **Peak Request Types:** Code Compliance (overgrown vegetation), ARR (missed collection)

## API Endpoints

### `POST /api/chat`

Stream chat responses using Server-Sent Events (SSE).

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "What is the average response time?" }
  ]
}
```

**Response:** SSE stream with Vercel AI SDK protocol format
```
data: {"type":"start","messageId":"..."}
data: {"type":"text-start","id":"..."}
data: {"type":"text-delta","id":"...","delta":"Hello"}
data: {"type":"text-delta","id":"...","delta":" there"}
data: {"type":"text-end","id":"..."}
data: {"type":"finish"}
data: [DONE]
```

## License

MIT
