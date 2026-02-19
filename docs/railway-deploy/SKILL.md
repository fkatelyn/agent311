---
name: railway-deploy
description: >
  Use when the user asks to "deploy to railway", "create a railway service",
  "set up railway", "deploy python to railway", "deploy react to railway",
  "deploy docker to railway", "check railway status", "debug railway deployment",
  "set railway variables", "generate railway domain", or discusses Railway
  infrastructure or Railpack/Nixpacks configuration.
version: 2.0.0
---

# Railway Deployment Skill

Automate Railway deployments via the Railway CLI. Supports three deployment types:
- **A:** Python/FastAPI (Railpack + uv)
- **B:** React/JavaScript Frontend (Railpack)
- **C:** Docker Image Service

## Decision Tree

Determine the deployment type from the user's request:

| Signal | Type |
|--------|------|
| Python, FastAPI, uvicorn, uv, `pyproject.toml` | **A — Python/FastAPI** |
| Next.js, React, Node, frontend, JavaScript, `package.json`, agentui | **B — Next.js Frontend** |
| Docker, Dockerfile, container, image | **C — Docker** |
| Unclear | Ask the user which type |

---

## Step 0: Pre-flight Checks

Run these before every deployment:

### 0.1 — Verify Railway CLI and auth
```bash
railway whoami
```
- If not logged in: instruct the user to run `railway login`
- If CLI not installed: instruct the user to install via `brew install railway`

### 0.2 — Find or create project
```bash
railway list
```
- If the target project exists, link to it:
  ```bash
  railway link
  ```
- If not, create one:
  ```bash
  railway init
  ```

### 0.3 — Check existing services and link
```bash
railway status
```
- Link to target service:
  ```bash
  railway service <service-name>
  ```

### 0.4 — Link environment
```bash
railway environment production
```

---

## Section A: Python/FastAPI (Railpack + uv)

### A.1 — Verify required files exist

Check that all of these exist at the **service root** (e.g., `agent311/`):

| File | Purpose |
|------|---------|
| `pyproject.toml` | Project metadata + dependencies |
| `uv.lock` | Lockfile (triggers uv detection via mise) |
| `railpack.json` | Railpack config (start command) |
| `railway.json` | Builder config |
| `.python-version` | Python version pin |
| `agent311/__init__.py` | Package init (makes module importable) |

If any are missing, create them with the content below.

### A.2 — Required file contents

**pyproject.toml:**
```toml
[project]
name = "agent311"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "claude-agent-sdk",
    "fastapi",
    "uvicorn",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**railpack.json:**
```json
{
  "$schema": "https://schema.railpack.com",
  "deploy": {
    "startCommand": "python -m uvicorn agent311.main:app --host 0.0.0.0 --port ${PORT:-8000}"
  }
}
```

**railway.json:**
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK"
  }
}
```

**.python-version:**
```
3.12
```

### A.3 — Deploy
```bash
cd <service-dir>
railway link
railway service <service-name>
railway environment production
railway up
```

### A.4 — Generate domain
```bash
railway domain
```

### A.5 — Verify deployment
```bash
railway status
railway logs --lines 50
```

If deployment failed, check logs:
```bash
# Build logs
railway logs --lines 100

# Filter for errors
railway logs --filter "error" --lines 50
```

### A.6 — Gotchas checklist

- [ ] `pyproject.toml` and `uv.lock` are at service root (NOT in a subdirectory)
- [ ] `build-backend = "hatchling.build"` (NOT `hatchling.backends`)
- [ ] Start command uses `python -m uvicorn` (NOT bare `uvicorn`)
- [ ] App binds to `0.0.0.0` and uses `${PORT:-8000}`

---

## Section B: Next.js Frontend (Railpack)

### B.1 — Verify required files exist

Check that these exist in the **`agentui/`** directory:

| File | Purpose |
|------|---------|
| `package.json` | Node.js dependencies |
| `railpack.json` | Start command config |
| `next.config.ts` | Next.js configuration |

### B.2 — Required file contents

**agentui/railpack.json:**
```json
{
  "$schema": "https://schema.railpack.com",
  "deploy": {
    "startCommand": "npm run start"
  }
}
```

### B.3 — Set root directory

The frontend lives in `agentui/`. Set the root directory in the Railway dashboard:

**Settings > General > Root Directory → set to `agentui`**

Then redeploy from the dashboard or run `railway up` from inside the `agentui/` directory.

### B.4 — Ensure CORS on backend

The FastAPI backend must allow cross-origin requests:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### B.5 — Link service and deploy
```bash
cd agentui
railway link
railway service agentui
railway environment production

# Set variables
railway variables set NEXT_PUBLIC_API_URL=https://<backend-domain>.up.railway.app

railway up
railway domain
```

### B.6 — Gotchas checklist

- [ ] `NEXT_PUBLIC_API_URL` set via `railway variables set` before deploy
- [ ] Root directory set to `agentui/` in Railway dashboard
- [ ] Backend has `CORSMiddleware` configured
- [ ] `package.json` is in `agentui/` (Railpack Node.js detection)

---

## Section C: Docker Image Service

### C.1 — When to use Docker vs Railpack

Use Docker when:
- You need precise control over the build environment
- The app requires system packages not available in Railpack
- You have an existing Dockerfile
- Multi-stage builds are needed for optimization

Use Railpack when:
- Standard Python or Node.js app
- You want zero-config deployment
- Simpler setup is preferred

### C.2 — Verify Dockerfile exists

Ensure a `Dockerfile` exists at the root of the service directory.

### C.3 — Example Dockerfiles

**Python/FastAPI:**
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --no-dev --frozen

COPY agent311/ ./agent311/

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "agent311.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Node.js/React (multi-stage):**
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "dist", "-l", "3000"]
```

### C.4 — Set builder to DOCKERFILE

**railway.json:**
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  }
}
```

### C.5 — Deploy
```bash
railway link
railway service <service-name>
railway environment production

railway variables set PORT=8000
railway up
railway domain
```

### C.6 — Gotchas checklist

- [ ] `railway.json` has `"builder": "DOCKERFILE"`
- [ ] `.dockerignore` excludes `node_modules/`, `.git/`, `__pycache__/`
- [ ] App uses `${PORT:-8000}` or reads the PORT env var
- [ ] `EXPOSE` matches the port the app listens on

---

## Debugging Failed Deployments

### Step 1: Check build logs
```bash
railway logs --lines 100
```

### Step 2: Stream live deploy logs
```bash
railway logs --follow
```

### Step 3: Filter for errors
```bash
railway logs --filter "error" --lines 50
```

### Step 4: Verify environment variables
```bash
railway variables
```

### Step 5: Check deployment status
```bash
railway status
```

For detailed error references, see [references/troubleshooting.md](references/troubleshooting.md).
