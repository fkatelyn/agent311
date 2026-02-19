# Railway Deployment Troubleshooting

Consolidated error table and gotchas for Railway deployments using Railpack and Docker.

---

## Python / FastAPI (Railpack + uv)

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| `uv: command not found` | Build fails immediately | `pyproject.toml` and `uv.lock` not at service root | Move both files to service root |
| `No module named 'hatchling.backends'` | Build fails resolving build-system | Wrong `build-backend` value in `pyproject.toml` | Change to `build-backend = "hatchling.build"` |
| `uvicorn: command not found` | App starts but crashes immediately | venv `bin/` not on PATH at runtime | Use `python -m uvicorn` instead of bare `uvicorn` |
| `ModuleNotFoundError: No module named 'agent311'` | Runtime import error | Package structure issue or missing `__init__.py` | Ensure `agent311/__init__.py` exists and `pyproject.toml` is at service root |
| `Address already in use` | Deployment crashes on start | Hardcoded port conflicts with Railway's PORT | Use `${PORT:-8000}` in start command |
| Build succeeds but app not reachable | No public URL | Domain not generated | Run `railway domain` |

---

## Next.js Frontend (Railpack)

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| "Failed to connect to backend" | Frontend loads but API calls fail | `NEXT_PUBLIC_API_URL` not set | Run `railway variables set NEXT_PUBLIC_API_URL=https://...` and redeploy |
| CORS error in browser console | Browser blocks cross-origin requests | Backend missing CORS middleware | Add `CORSMiddleware` to FastAPI with `allow_origins=["*"]` |
| Frontend deploys but serves Python app | Wrong app running on frontend service | Root directory not set to `agentui/` | Set root directory in Railway dashboard: Settings > General > Root Directory |
| `npm run start` fails | Start command not found | `start` script missing from `package.json` | Ensure `package.json` has `"start": "next start"` in scripts |
| Blank page after deploy | App loads but nothing renders | Build step didn't run | Ensure `package.json` has a `build` script and Railpack ran it |
| `.next/` not found | Start command crashes | Build step didn't produce output | Check build logs with `railway logs --lines 100` |

---

## Docker Deployments

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| `Dockerfile not found` | Build fails immediately | Dockerfile not at root or root directory misconfigured | Set correct root directory or move Dockerfile to root |
| Build context too large | Build is slow or times out | No `.dockerignore` | Add `.dockerignore` excluding `node_modules/`, `.git/`, `__pycache__/`, etc. |
| `EXPOSE` port mismatch | App starts but not reachable | Container exposes different port than app listens on | Ensure `EXPOSE` matches app port and use `${PORT:-8000}` |
| Multi-stage build fails | Missing files in final image | Files not copied from builder stage | Verify `COPY --from=builder` paths match build stage output |
| Railway can't detect Dockerfile | Falls back to Railpack | `railway.json` builder not set to `DOCKERFILE` | Set `"builder": "DOCKERFILE"` in `railway.json` |

---

## Railway CLI Errors

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| "Not logged in" | CLI commands fail | Railway CLI not authenticated | Run `railway login` |
| "No linked project" | Deploy/list commands fail | Directory not linked to a Railway project | Run `railway link` or `railway init` |
| "No linked service" | Deploy goes to wrong service | Multiple services, none explicitly linked | Run `railway service <name>` |
| Variable set but deploy not triggered | Old code still running | Variables changed but no redeploy | Run `railway up` to trigger a new deployment |
| CLI out of date | Commands fail or flags not recognized | Old Railway CLI version | Run `railway update` or `brew upgrade railway` |

---

## General Railway Issues

| Error | Symptom | Cause | Fix |
|-------|---------|-------|-----|
| Auto-deploy not triggering | Push to GitHub but no new deployment | GitHub repo not connected or branch mismatch | Connect repo in Railway dashboard, verify branch settings |
| Service stuck in "deploying" | Deployment never completes | Build timeout or resource limits | Check build logs with `railway logs`. Increase plan limits if needed |
| Domain shows "502 Bad Gateway" | App crashed after deploy | Runtime error in application | Check deploy logs: `railway logs --filter "error"` |
| Health check failing | Deployment rolls back | App doesn't respond on expected port | Ensure app binds to `0.0.0.0:${PORT}` and responds to GET `/` |
| Environment variables missing | App uses defaults or crashes | Vars set on wrong service/environment | Verify with `railway variables` |

---

## Debugging Flowchart

```
Deployment Failed?
├── Check build logs:  railway logs --lines 100
│   ├── "uv: command not found" → See Python table above
│   ├── "npm ERR!" → See React table above
│   └── "Dockerfile not found" → See Docker table above
│
├── Build succeeded but app not running?
│   ├── Stream live logs:  railway logs --follow
│   │   ├── "ModuleNotFoundError" → Missing dependency or __init__.py
│   │   ├── "Address already in use" → Use ${PORT:-8000}
│   │   └── "uvicorn: command not found" → Use python -m uvicorn
│   └── Check variables:  railway variables
│       └── Missing expected vars → railway variables set KEY=value
│
└── App running but not reachable?
    ├── No domain → railway domain
    ├── CORS error → Add CORSMiddleware to backend
    └── 502 error → App is crashing — railway logs --filter "error"
```
