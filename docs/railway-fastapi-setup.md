# Setting Up FastAPI with uv on Railway

This documents the full process of deploying a FastAPI app using uv as the Python package manager on Railway with Railpack.

## Prerequisites

- A Railway account
- A GitHub repo connected to Railway
- [uv](https://docs.astral.sh/uv/) installed locally

## Project Structure

Railway (Railpack) requires `pyproject.toml` and `uv.lock` at the **service root** for auto-detection.

```
repo-root/
├── agent311/
│   ├── __init__.py          # Makes it a Python package
│   └── main.py              # FastAPI app
├── pyproject.toml            # Must be at root
├── uv.lock                   # Must be at root
├── railpack.json             # Railpack config
├── railway.json              # Railway builder config
├── .python-version           # Python version pin
└── start.sh                  # Local dev startup
```

## Step 1: Create the FastAPI App

`agent311/main.py`:

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def hello():
    return {"message": "Hello, World!"}
```

`agent311/__init__.py`: empty file (makes it importable as `agent311.main`).

## Step 2: Configure pyproject.toml

Must be at the **service root** (not in a subdirectory).

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

**Gotcha:** The build backend is `hatchling.build`, NOT `hatchling.backends` (which doesn't exist and will fail the build).

## Step 3: Generate uv.lock

```bash
uv lock
```

This creates `uv.lock` at the repo root. Commit it to the repo. Railpack uses the presence of `pyproject.toml` + `uv.lock` to auto-detect uv as the package manager (installed via **mise** at build time).

## Step 4: Pin Python Version

Create `.python-version` at the service root:

```
3.12
```

Railpack reads this file automatically — no explicit config needed.

## Step 5: Configure Railpack

`railpack.json`:

```json
{
  "$schema": "https://schema.railpack.com",
  "deploy": {
    "startCommand": "python -m uvicorn agent311.main:app --host 0.0.0.0 --port ${PORT:-8000}"
  }
}
```

**Key details:**
- Railpack auto-detects uv from `pyproject.toml` + `uv.lock` and installs the latest uv via mise. No version pin needed.
- Python version is read from `.python-version` automatically.
- Use `python -m uvicorn` (not bare `uvicorn`) because the venv `bin/` may not be on PATH at runtime.

## Step 6: Configure Railway Builder

`railway.json`:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK"
  }
}
```

## Step 7: Deploy

Push to GitHub. Railway auto-deploys on push.

What Railpack does automatically:
1. Detects `pyproject.toml` + `uv.lock` at service root
2. Installs the latest uv via mise
3. Sets up Python 3.12 (from `.python-version`)
4. Runs `uv sync --frozen` to install all dependencies
5. Starts the app with the command from `railpack.json`

## Step 8: Generate a Public Domain

By default, Railway services don't have a public URL. To make it accessible:

1. Go to your service in the Railway dashboard
2. Click **Settings** > **Networking**
3. Click **Generate Domain** under Public Networking

Or via the Railway CLI:

```bash
railway domain
```

This gives you a URL like `https://your-service-production.up.railway.app/`.

## Verify

```bash
curl https://your-service-production.up.railway.app/
# {"message":"Hello, World!"}
```

Visit `/docs` for the auto-generated FastAPI Swagger UI.

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `uv: command not found` | `pyproject.toml`/`uv.lock` not at service root | Move files to service root |
| `No module named 'hatchling.backends'` | Wrong build-backend value | Change to `build-backend = "hatchling.build"` |
| `uvicorn: command not found` | venv bin not on PATH | Use `python -m uvicorn` instead of bare `uvicorn` |
| `curl: command not found` in start.sh | Minimal container image | Don't rely on curl at runtime; install apt packages via `buildAptPackages` in `railpack.json` if needed |

## Local Development

```bash
# From service root
uv run uvicorn agent311.main:app --host 0.0.0.0 --port 8000 --reload
```

Or use `start.sh`:

```bash
./start.sh
```
