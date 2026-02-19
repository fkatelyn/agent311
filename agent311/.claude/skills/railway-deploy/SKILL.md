---
name: railway-deploy
description: >
  Use when the user asks to "deploy to railway", "create a railway service",
  "set up railway", "deploy python to railway", "deploy react to railway",
  "deploy docker to railway", "check railway status", "debug railway deployment",
  "set railway variables", "generate railway domain", or discusses Railway
  infrastructure or Railpack/Nixpacks configuration.
version: 1.0.0
---

# Railway Deployment Skill

Automate Railway deployments via MCP tools. Supports three deployment types:
- **A:** Python/FastAPI (Railpack + uv)
- **B:** React/JavaScript Frontend (Railpack)
- **C:** Docker Image Service

## Decision Tree

Determine the deployment type from the user's request:

| Signal | Type |
|--------|------|
| Python, FastAPI, uvicorn, uv, `pyproject.toml` | **A — Python/FastAPI** |
| React, Vite, Node, frontend, JavaScript, `package.json` | **B — React/JS Frontend** |
| Docker, Dockerfile, container, image | **C — Docker** |
| Unclear | Ask the user which type |

---

## Step 0: Pre-flight Checks

Run these before every deployment:

### 0.1 — Verify Railway CLI and auth
```
mcp__Railway__check-railway-status()
```
- If not logged in: instruct the user to run `railway login --browserless`
- If CLI not installed: instruct the user to install via `npm install -g @railway/cli`

### 0.2 — Find or create project
```
mcp__Railway__list-projects()
```
- If the target project exists, proceed to link it
- If not, create one:
```
mcp__Railway__create-project-and-link(
  projectName: "<project-name>",
  workspacePath: "<repo-root>"
)
```

### 0.3 — Check existing services
```
mcp__Railway__list-services(workspacePath: "<repo-root>")
```
- Identify if the target service already exists
- Link to it if needed:
```
mcp__Railway__link-service(
  workspacePath: "<repo-root>",
  serviceName: "<service-name>"
)
```

### 0.4 — Link environment
```
mcp__Railway__link-environment(
  workspacePath: "<repo-root>",
  environmentName: "production"
)
```

---

## Section A: Python/FastAPI (Railpack + uv)

### A.1 — Verify required files exist

Check that all of these exist at the **repo root**:

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
    "claude-code-sdk",
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
```
mcp__Railway__deploy(
  workspacePath: "<repo-root>",
  service: "<service-name>"
)
```

### A.4 — Generate domain
```
mcp__Railway__generate-domain(
  workspacePath: "<repo-root>",
  service: "<service-name>"
)
```

### A.5 — Verify deployment
```
mcp__Railway__list-deployments(
  workspacePath: "<repo-root>",
  service: "<service-name>",
  json: true,
  limit: 3
)
```

If deployment failed, check logs:
```
mcp__Railway__get-logs(
  workspacePath: "<repo-root>",
  logType: "build",
  service: "<service-name>"
)
```

### A.6 — Gotchas checklist

- [ ] `pyproject.toml` and `uv.lock` are at service root (NOT in a subdirectory)
- [ ] `build-backend = "hatchling.build"` (NOT `hatchling.backends`)
- [ ] Start command uses `python -m uvicorn` (NOT bare `uvicorn`)
- [ ] App binds to `0.0.0.0` and uses `${PORT:-8000}`

---

## Section B: React/JS Frontend (Railpack)

### B.1 — Verify required files exist

Check that these exist in the **frontend directory** (e.g., `frontend/`):

| File | Purpose |
|------|---------|
| `package.json` | Node.js dependencies |
| `railpack.json` | Build + serve config |
| `.env.production` | Build-time env vars (VITE_API_URL) |
| `vite.config.js` | Vite configuration |

### B.2 — Required file contents

**frontend/railpack.json:**
```json
{
  "$schema": "https://schema.railpack.com",
  "deploy": {
    "startCommand": "npx serve dist"
  }
}
```

**frontend/.env.production:**
```
VITE_API_URL=https://<backend-domain>.up.railway.app
```

### B.3 — Set root directory

The frontend lives in a subdirectory. Set the root directory via Railway GraphQL API:

```bash
curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { serviceInstanceUpdate(serviceId: \"<SERVICE_ID>\", environmentId: \"<ENV_ID>\", input: { rootDirectory: \"frontend\" }) }"
  }'
```

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
```
mcp__Railway__link-service(
  workspacePath: "<repo-root>",
  serviceName: "frontend"
)

mcp__Railway__set-variables(
  workspacePath: "<repo-root>",
  variables: ["VITE_API_URL=https://<backend-domain>.up.railway.app"],
  service: "frontend"
)

mcp__Railway__deploy(
  workspacePath: "<repo-root>",
  service: "frontend"
)

mcp__Railway__generate-domain(
  workspacePath: "<repo-root>",
  service: "frontend"
)
```

### B.6 — Gotchas checklist

- [ ] `.env.production` exists with `VITE_API_URL` (Vite embeds at build time only)
- [ ] Root directory set to `frontend/` via Railway API
- [ ] Backend has `CORSMiddleware` configured
- [ ] `package.json` is in the frontend root (Railpack Node.js detection)
- [ ] Railway dashboard vars are runtime only — they do NOT work for `VITE_*`

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

Or via GraphQL API:
```bash
curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { serviceInstanceUpdate(serviceId: \"<SERVICE_ID>\", environmentId: \"<ENV_ID>\", input: { builder: DOCKERFILE }) }"
  }'
```

### C.5 — Deploy
```
mcp__Railway__set-variables(
  workspacePath: "<repo-root>",
  variables: ["PORT=8000"],
  service: "<service-name>"
)

mcp__Railway__deploy(
  workspacePath: "<repo-root>",
  service: "<service-name>"
)

mcp__Railway__generate-domain(
  workspacePath: "<repo-root>",
  service: "<service-name>"
)
```

### C.6 — Gotchas checklist

- [ ] `railway.json` has `"builder": "DOCKERFILE"`
- [ ] `.dockerignore` excludes `node_modules/`, `.git/`, `__pycache__/`
- [ ] App uses `${PORT:-8000}` or reads the PORT env var
- [ ] `EXPOSE` matches the port the app listens on

---

## Debugging Failed Deployments

### Step 1: Check build logs
```
mcp__Railway__get-logs(
  workspacePath: "<repo-root>",
  logType: "build",
  service: "<service-name>",
  lines: 100
)
```

### Step 2: Check deploy logs (runtime)
```
mcp__Railway__get-logs(
  workspacePath: "<repo-root>",
  logType: "deploy",
  service: "<service-name>",
  lines: 100
)
```

### Step 3: Filter for errors
```
mcp__Railway__get-logs(
  workspacePath: "<repo-root>",
  logType: "deploy",
  service: "<service-name>",
  filter: "@level:error",
  lines: 50
)
```

### Step 4: Verify environment variables
```
mcp__Railway__list-variables(
  workspacePath: "<repo-root>",
  service: "<service-name>",
  kv: true
)
```

### Step 5: Check deployment status
```
mcp__Railway__list-deployments(
  workspacePath: "<repo-root>",
  service: "<service-name>",
  json: true,
  limit: 5
)
```

For detailed error references, see [references/troubleshooting.md](references/troubleshooting.md).
For full MCP tool API details, see [references/mcp-tool-reference.md](references/mcp-tool-reference.md).
