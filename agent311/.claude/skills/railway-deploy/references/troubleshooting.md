# Railway Deployment Troubleshooting

Consolidated error table and gotchas for Railway deployments using Nixpacks, Docker, and MCP tools.

---

## Python / FastAPI (Nixpacks + uv)

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| `uv: command not found` | Build fails immediately | `pyproject.toml` and `uv.lock` not at repo root, or custom `[phases.install]` in nixpacks.toml overrides auto-detection | Move both files to repo root. Remove any custom install phases from `nixpacks.toml` |
| `pip install uv==0.4.30` fails | Build crashes during uv install | Default Nixpacks uv version (0.4.30) is too old | Set `NIXPACKS_UV_VERSION = "0.10.0"` in `nixpacks.toml` `[variables]` |
| `No module named 'hatchling.backends'` | Build fails resolving build-system | Wrong `build-backend` value in `pyproject.toml` | Change to `build-backend = "hatchling.build"` |
| `uvicorn: command not found` | App starts but crashes immediately | Nixpacks venv `bin/` not on PATH at runtime | Use `python -m uvicorn` instead of bare `uvicorn` |
| `ModuleNotFoundError: No module named 'agent311'` | Runtime import error | Package structure issue or missing `__init__.py` | Ensure `agent311/__init__.py` exists and `pyproject.toml` is at repo root |
| `Address already in use` | Deployment crashes on start | Hardcoded port conflicts with Railway's PORT | Use `${PORT:-8000}` in start command |
| Build succeeds but app not reachable | No public URL | Domain not generated | Run `mcp__Railway__generate-domain` or add domain in Railway dashboard |
| `NIXPACKS_PYTHON_PACKAGE_MANAGER` not set | Nixpacks uses pip instead of uv | Env var not configured | Set `NIXPACKS_PYTHON_PACKAGE_MANAGER=uv` via `mcp__Railway__set-variables` or Railway dashboard |

---

## React / JavaScript Frontend (Nixpacks)

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| "Failed to connect to backend" | Frontend loads but API calls fail | `VITE_API_URL` not set at build time | Add `.env.production` with backend URL. Vite embeds `VITE_*` vars at build time only |
| CORS error in browser console | Browser blocks cross-origin requests | Backend missing CORS middleware | Add `CORSMiddleware` to FastAPI with `allow_origins=["*"]` |
| Frontend deploys but serves Python app | Wrong app running on frontend service | Root directory not set to `frontend/` | Set `rootDirectory: "frontend"` via Railway GraphQL API (`serviceInstanceUpdate`) |
| `npx serve: command not found` | Start command fails | Node.js not detected by Nixpacks | Ensure `package.json` is in the root directory of the service (after root dir is set) |
| `VITE_API_URL` is `undefined` at runtime | API calls go to wrong URL | Set var in Railway dashboard instead of `.env.production` | Railway vars are runtime only; Vite needs them at build time. Use `.env.production` |
| Blank page after deploy | JS bundle has errors | Build command not configured | Set `[build] cmd = "npm install && npm run build"` in `nixpacks.toml` |
| `dist/` not found | Serve command can't find built files | Build step didn't run or output dir mismatch | Check Vite `build.outDir` matches serve command path |

---

## Docker Deployments

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| `Dockerfile not found` | Build fails immediately | Dockerfile not at root or root directory misconfigured | Set correct root directory or move Dockerfile to root |
| Build context too large | Build is slow or times out | No `.dockerignore` | Add `.dockerignore` excluding `node_modules/`, `.git/`, `__pycache__/`, etc. |
| `EXPOSE` port mismatch | App starts but not reachable | Container exposes different port than app listens on | Ensure `EXPOSE` matches app port and use `${PORT:-8000}` |
| Multi-stage build fails | Missing files in final image | Files not copied from builder stage | Verify `COPY --from=builder` paths match build stage output |
| Railway can't detect Dockerfile | Falls back to Nixpacks | `railway.json` builder not set to `DOCKERFILE` | Set `"builder": "DOCKERFILE"` in `railway.json` |

---

## MCP Tool Errors

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| MCP server not responding | All Railway MCP tool calls fail | MCP server not configured or not running | Check `.claude/settings.local.json` for Railway MCP config. Restart Claude Code |
| "Not logged in" | `check-railway-status` reports unauthenticated | Railway CLI not authenticated | Run `railway login --browserless` and enter the token |
| "No linked project" | Deploy/list commands fail | Workspace not linked to a Railway project | Run `mcp__Railway__create-project-and-link` or `mcp__Railway__link-service` |
| "No linked service" | Deploy goes to wrong service | Multiple services, none explicitly linked | Run `mcp__Railway__link-service` with the target service name |
| "No linked environment" | Operations target wrong env | Environment not linked | Run `mcp__Railway__link-environment(environmentName: "production")` |
| Variable set but deploy not triggered | Old code still running | `skipDeploys: true` was used | Re-deploy via `mcp__Railway__deploy` or push to trigger auto-deploy |
| `list-deployments` fails | CLI version error | Railway CLI older than v4.10.0 | Update Railway CLI: `railway update` |
| `get-logs` filter/lines ignored | Logs stream without filtering | Railway CLI older than v4.9.0 | Update Railway CLI: `railway update` |

---

## General Railway Issues

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| Auto-deploy not triggering | Push to GitHub but no new deployment | GitHub repo not connected or branch mismatch | Connect repo in Railway dashboard, verify branch settings |
| Service stuck in "deploying" | Deployment never completes | Build timeout or resource limits | Check build logs with `get-logs(logType: "build")`. Increase plan limits if needed |
| Domain shows "502 Bad Gateway" | App crashed after deploy | Runtime error in application | Check deploy logs: `get-logs(logType: "deploy", filter: "@level:error")` |
| Health check failing | Deployment rolls back | App doesn't respond on expected port | Ensure app binds to `0.0.0.0:${PORT}` and responds to GET `/` |
| Environment variables missing | App uses defaults or crashes | Vars set on wrong service/environment | Verify with `mcp__Railway__list-variables(service: "...", kv: true)` |

---

## Debugging Flowchart

```
Deployment Failed?
├── Check build logs:  get-logs(logType: "build")
│   ├── "uv: command not found" → See Python table above
│   ├── "npm ERR!" → See React table above
│   └── "Dockerfile not found" → See Docker table above
│
├── Build succeeded but app not running?
│   ├── Check deploy logs:  get-logs(logType: "deploy")
│   │   ├── "ModuleNotFoundError" → Missing dependency or __init__.py
│   │   ├── "Address already in use" → Use ${PORT:-8000}
│   │   └── "uvicorn: command not found" → Use python -m uvicorn
│   └── Check variables:  list-variables(kv: true)
│       └── Missing expected vars → set-variables(variables: [...])
│
└── App running but not reachable?
    ├── No domain → generate-domain()
    ├── CORS error → Add CORSMiddleware to backend
    └── 502 error → App is crashing — check deploy logs
```
