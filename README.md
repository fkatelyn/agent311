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

## Contributing

See [CLAUDE.md](CLAUDE.md) for development guidelines including:
- Commit directly to `main` (no PRs)
- Clean, natural commit messages
- Development commands and architecture

## License

MIT
