# Deploying the React Frontend on Railway

> **Note:** The Vite React `frontend/` service has been removed from this project. The current frontend is `agentui/` (Next.js). This doc is kept as a reference for deploying Vite React apps on Railway.

This documents deploying the Vite React frontend as a separate Railway service and connecting it to the FastAPI backend.

## Architecture

The frontend and backend run as **separate Railway services** in the same project:

```
Railway Project
├── agent311          (FastAPI backend)  → <backend>.up.railway.app
└── frontend          (React app)       → <frontend>.up.railway.app
```

The React app fetches data from the FastAPI backend at runtime via `VITE_API_URL`.

## Project Structure

```
repo-root/
├── agent311/                  # FastAPI backend
│   └── main.py
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── railpack.json          # Frontend Railpack config
│   └── .env.production        # Build-time env vars
├── pyproject.toml
├── railpack.json              # Backend Railpack config
└── railway.json
```

## Connecting to the FastAPI Backend

### 1. CORS on the Backend

The FastAPI backend must allow cross-origin requests from the frontend domain. In `agent311/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Without this, the browser blocks fetch requests from the frontend to the backend because they're on different domains.

### 2. API URL in the Frontend

The frontend uses `VITE_API_URL` to know where the backend lives. In `src/App.jsx`:

```jsx
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

useEffect(() => {
  fetch(API_URL)
    .then((res) => res.json())
    .then((data) => setMessage(data.message))
    .catch(() => setMessage("Failed to connect to backend"));
}, []);
```

The fallback `http://localhost:8000` is used for local development.

### 3. Setting VITE_API_URL at Build Time

Vite embeds `VITE_*` environment variables into the JavaScript bundle **at build time** (not runtime). This means the variable must be available when `vite build` runs.

**Use `.env.production`** — this is Vite's standard mechanism:

`frontend/.env.production`:
```
VITE_API_URL=https://<your-backend-service>.up.railway.app
```

Vite reads this file automatically during `vite build` in production mode.

**Gotcha:** Railway environment variables are only available at container runtime, NOT during the Docker build step. Setting `VITE_API_URL` in the Railway dashboard will **not** work for Vite — the value won't be embedded in the bundle. You must use `.env.production`.

## Frontend Railpack Config

`frontend/railpack.json`:

```json
{
  "$schema": "https://schema.railpack.com",
  "deploy": {
    "startCommand": "npx serve dist"
  }
}
```

Railpack auto-detects Node.js from `package.json`. The build step (`npm run build`) compiles the React app, and the start step serves the static `dist/` folder using `serve`.

## Railway Setup

### Step 1: Create the Frontend Service

Using the Railway CLI:

```bash
railway add --service frontend --repo fkatelyn/agent311
```

This creates a new service linked to the GitHub repo.

### Step 2: Set the Root Directory

The frontend code lives in `frontend/`, not the repo root. Set the root directory via the Railway GraphQL API:

```bash
curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { serviceInstanceUpdate(serviceId: \"<SERVICE_ID>\", environmentId: \"<ENV_ID>\", input: { rootDirectory: \"frontend\" }) }"
  }'
```

You can find your service and environment IDs with `railway status --json`.

### Step 3: Set the Builder

Set the builder to RAILPACK via `railway.json` in the frontend directory:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK"
  }
}
```

### Step 4: Set Environment Variables

Note: `VITE_API_URL` must come from `.env.production` (committed to the repo), not from Railway dashboard env vars. See the build-time gotcha above.

### Step 5: Generate a Public Domain

Using the Railway MCP or CLI:

```bash
railway domain --service frontend
```

### Step 6: Deploy

Push to GitHub — Railway auto-deploys on push. Or deploy manually:

```bash
cd frontend
railway up --service frontend
```

## Local Development

```bash
cd frontend
npm install
npm run dev
```

This starts the Vite dev server. The app fetches from `http://localhost:8000` by default (the fallback in `App.jsx`), so make sure the FastAPI backend is running locally too:

```bash
# In another terminal, from repo root
uv run uvicorn agent311.main:app --host 0.0.0.0 --port 8000 --reload
```

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| "Failed to connect to backend" | `VITE_API_URL` not set at build time | Add `.env.production` with the backend URL |
| CORS error in browser console | Backend missing CORS middleware | Add `CORSMiddleware` to FastAPI app |
| Frontend deploys but serves Python app | Root directory not set to `frontend/` | Set `rootDirectory: "frontend"` via Railway API |
| `npx serve` not found | Node.js not detected by Railpack | Ensure `package.json` is in the root directory of the service |
