# Setting Up FastAPI with uv on Railway

This documents the full process of deploying a FastAPI app using uv as the Python package manager on Railway with Nixpacks.

## Prerequisites

- A Railway account
- A GitHub repo connected to Railway
- [uv](https://docs.astral.sh/uv/) installed locally

## Project Structure

Railway (Nixpacks) requires `pyproject.toml` and `uv.lock` at the **repo root** for auto-detection.

```
repo-root/
├── agent311/
│   ├── __init__.py          # Makes it a Python package
│   └── main.py              # FastAPI app
├── pyproject.toml            # Must be at root
├── uv.lock                   # Must be at root
├── nixpacks.toml             # Nixpacks config
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

Must be at the **repo root** (not in a subdirectory).

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

This creates `uv.lock` at the repo root. Commit it to the repo. Nixpacks uses the presence of this file to auto-detect uv as the package manager.

## Step 4: Pin Python Version

Create `.python-version` at the repo root:

```
3.12
```

## Step 5: Configure Nixpacks

`nixpacks.toml`:

```toml
[variables]
NIXPACKS_UV_VERSION = "0.10.0"

[start]
cmd = "python -m uvicorn agent311.main:app --host 0.0.0.0 --port ${PORT:-8000}"
```

**Key details:**
- `NIXPACKS_UV_VERSION` must be set to a recent version. Nixpacks defaults to `0.4.30` which is ancient and will fail to install.
- Use `python -m uvicorn` (not bare `uvicorn`) because the venv `bin/` may not be on PATH at runtime.
- Do NOT add custom install commands (`[phases.install]`). This overrides Nixpacks' automatic uv installation and causes "uv: command not found" errors. Let Nixpacks handle the install phase automatically.

## Step 6: Configure Railway Builder

`railway.json`:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  }
}
```

## Step 7: Set Railway Environment Variable

In the Railway dashboard, go to your service > Variables and add:

```
NIXPACKS_PYTHON_PACKAGE_MANAGER=uv
```

This explicitly tells Nixpacks to use uv instead of pip.

## Step 8: Deploy

Push to GitHub. Railway auto-deploys on push.

What Nixpacks does automatically:
1. Detects `pyproject.toml` + `uv.lock` at repo root
2. Sets up Python 3.12 via Nix
3. Creates a venv and installs uv via pip (`pip install uv==$NIXPACKS_UV_VERSION`)
4. Runs `uv sync --no-dev --frozen` to install all dependencies
5. Starts the app with the command from `nixpacks.toml`

## Step 9: Generate a Public Domain

By default, Railway services don't have a public URL. To make it accessible:

1. Go to your service in the Railway dashboard
2. Click **Settings** > **Networking**
3. Click **Generate Domain** under Public Networking

This gives you a URL like `https://your-service-production.up.railway.app/`.

You can also generate a domain via the Railway GraphQL API:

```graphql
mutation {
  serviceDomainCreate(
    input: {
      serviceId: "your-service-id"
      environmentId: "your-environment-id"
    }
  ) {
    domain
  }
}
```

## Verify

```bash
curl https://your-service-production.up.railway.app/
# {"message":"Hello, World!"}
```

Visit `/docs` for the auto-generated FastAPI Swagger UI.

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `uv: command not found` | pyproject.toml/uv.lock not at repo root, or custom install phase overrides auto-detection | Move files to root, remove custom `[phases.install]` from nixpacks.toml |
| `pip install uv==0.4.30` fails | Default uv version is too old | Set `NIXPACKS_UV_VERSION = "0.10.0"` in nixpacks.toml `[variables]` |
| `No module named 'hatchling.backends'` | Wrong build-backend value | Change to `build-backend = "hatchling.build"` |
| `uvicorn: command not found` | venv bin not on PATH | Use `python -m uvicorn` instead of bare `uvicorn` |
| `curl: command not found` in start.sh | Minimal container image | Don't install tools at runtime; let Nixpacks handle build-time installs |

## Local Development

```bash
# From repo root
uv run uvicorn agent311.main:app --host 0.0.0.0 --port 8000 --reload
```

Or use `start.sh`:

```bash
./start.sh
```
