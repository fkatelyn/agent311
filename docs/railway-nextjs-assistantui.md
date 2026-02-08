# Deploying Next.js assistant-ui on Railway (Monorepo Subdirectory)

This documents deploying the [assistant-ui](https://github.com/assistant-ui/assistant-ui) Next.js frontend as a third Railway service alongside the existing FastAPI backend and Vite frontend. It covers every pitfall encountered during the real deployment.

## Architecture

Three services in one Railway project, one GitHub repo:

```
Railway Project (powerful-dream)
├── agent311       (FastAPI backend)      → agent311-production.up.railway.app
├── frontend       (React/Vite)           → frontend-production-893c.up.railway.app
└── assistantui    (Next.js assistant-ui) → assistantui-production.up.railway.app
```

Both frontends talk to the same backend via `/api/chat`. The backend handles both the old `content`-string format (Vite frontend) and the AI SDK v6 `parts`-array format (assistant-ui).

## Project Structure

```
repo-root/
├── agent311/                  # FastAPI backend (root dir: /)
│   └── main.py
├── frontend/                  # Vite frontend (root dir: /frontend)
│   ├── package.json
│   └── nixpacks.toml
├── assistantui/               # Next.js frontend (root dir: /assistantui)
│   ├── app/
│   │   ├── assistant.tsx      # API URL + runtime config
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── assistant-ui/
│   │       ├── thread.tsx     # Chat UI with 311 branding
│   │       └── markdown-text.tsx
│   ├── package.json           # engines.node >= 20.9.0
│   ├── nixpacks.toml          # providers = ["node"]
│   └── railway.json           # Config-as-code
├── pyproject.toml             # Backend (repo root)
├── nixpacks.toml              # Backend Nixpacks
└── railway.json               # Backend Railway config
```

## Config Files

### `assistantui/package.json` (key fields)

```json
{
  "name": "assistant-ui-starter",
  "private": true,
  "engines": {
    "node": ">=20.9.0"
  },
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@assistant-ui/react": "^0.12.1",
    "@assistant-ui/react-ai-sdk": "^1.3.1",
    "@assistant-ui/react-markdown": "^0.12.0",
    "ai": "^6.0.50",
    "next": "16.1.5",
    "react": "^19.2.4"
  }
}
```

**Critical:** Do NOT include a `"packageManager"` field. The `assistant-ui` scaffolder adds `"packageManager": "pnpm@..."` which will force Nixpacks to use pnpm even if your nixpacks.toml says `npm install`.

**Critical:** The `"engines"` field is how Nixpacks picks the Node.js version. Without it, Nixpacks defaults to Node.js 18, which is too old for Next.js 16.

### `assistantui/nixpacks.toml`

```toml
providers = ["node"]

[variables]
NEXT_PUBLIC_API_URL = "https://agent311-production.up.railway.app"

[install]
cmd = "npm install"

[build]
cmd = "npm run build"

[start]
cmd = "npm start"
```

**Critical:** `providers = ["node"]` is required. Without it, Nixpacks sees the root `pyproject.toml` and detects the Python provider instead of Node.

**Note:** Unlike Vite, Next.js reads `NEXT_PUBLIC_*` env vars at both build time AND runtime, so setting them in `[variables]` works (no `.env.production` needed).

### `assistantui/railway.json`

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "nixpacksConfigPath": "nixpacks.toml"
  }
}
```

**Note:** `nixpacksConfigPath` is relative to the service's root directory (`/assistantui`), so use `"nixpacks.toml"` not `"assistantui/nixpacks.toml"`.

## Railway Dashboard Setup

These settings **cannot** be configured via MCP tools or CLI and must be done in the Railway dashboard. This was the most frustrating part of the deployment.

### Step 1: Create the Service

```bash
railway add --service assistantui --repo fkatelyn/agent311
```

Or create it in the Railway dashboard: Project > New Service > GitHub Repo.

### Step 2: Set Root Directory (Dashboard)

1. Go to the assistantui service in Railway dashboard
2. **Settings > Source > Root Directory** → set to `/assistantui`
3. This tells Railway to only look at files inside `assistantui/` for this service

### Step 3: Set Config-as-Code Path (Dashboard)

1. **Settings > Source > Config-as-code** → set to `assistantui/railway.json`
2. This path is relative to the **repo root** (not the root directory)
3. This tells Railway to read `assistantui/railway.json` for builder config

### Step 4: Apply Changes

1. After changing settings, Railway shows an **"N changes"** badge
2. You MUST click **Apply** for changes to take effect
3. **Gotcha:** If you don't apply, deploys continue using the old configuration — this is silent and very confusing

### Step 5: Generate Domain

```bash
railway domain --service assistantui
```

Or via MCP:
```
mcp__Railway__generate-domain(workspacePath: "...", service: "assistantui")
```

## Pitfalls Encountered (Chronological)

### 1. Python Provider Detected Instead of Node

**Symptom:** Build log shows `Providers: Python` and tries to install pip/uv.

**Cause:** The root `pyproject.toml` exists and Nixpacks auto-detects it even though the root directory is `/assistantui`.

**Fix:** Add `providers = ["node"]` to `assistantui/nixpacks.toml` to force Node.js detection.

### 2. Root Directory Not Applied

**Symptom:** Build uses the root `nixpacks.toml` (Python config) instead of `assistantui/nixpacks.toml`.

**Cause:** Root directory was set in the Railway dashboard but not Applied. Railway shows pending changes with an "N changes" badge that must be clicked.

**Fix:** Always click Apply after making any dashboard settings changes.

### 3. pnpm Frozen Lockfile Error

**Symptom:**
```
ERR_PNPM_NO_LOCKFILE Cannot install with "frozen-lockfile" because pnpm-lock.yaml is absent
```

**Cause:** `package.json` had `"packageManager": "pnpm@10.28.0"` (added by the `assistant-ui` scaffolder). Nixpacks detects this field and uses pnpm with `--frozen-lockfile`, ignoring the `[install] cmd = "npm install"` in nixpacks.toml.

**Fix:** Remove the `"packageManager"` field from `package.json`. The nixpacks.toml `[install]` override alone is NOT sufficient — Nixpacks' package manager detection happens at the provider level, before phase overrides.

### 4. Node.js 18 Too Old for Next.js 16

**Symptom:**
```
You are using Node.js 18.20.5. For Next.js, Node.js version ">=20.9.0" is required.
```

**Cause:** Nixpacks defaults to `nodejs_18` (Node.js 18.x). Next.js 16 requires Node.js 20+.

**Fix:** Add `"engines": {"node": ">=20.9.0"}` to `package.json`. Nixpacks reads this field and installs the matching Node.js version.

### 5. Config-as-Code Path Confusion

**Symptom:** Railway ignores `assistantui/railway.json` and uses root `railway.json` instead.

**Cause:** Config-as-code path must be explicitly set in the Railway dashboard. It's relative to the **repo root**, not the service root directory.

**Fix:** Set Config-as-code to `assistantui/railway.json` in dashboard Settings.

### 6. Backend Loses Conversation Memory

**Symptom:** Every message gets a fresh "Hello, I'm Agent 311!" response. The agent doesn't remember previous messages.

**Cause:** The AI SDK v6 (used by assistant-ui) sends messages in `UIMessage` format with a `parts` array, not a `content` string:

```json
// AI SDK v6 format (assistant-ui sends this)
{"role": "assistant", "parts": [{"type": "text", "text": "Hello!"}]}

// Old format (Vite frontend sends this)
{"role": "assistant", "content": "Hello!"}
```

The backend was reading `msg.get("content", "")` which returned empty string for the new format.

**Fix:** Add a helper that handles both formats:

```python
def _extract_text(msg: dict) -> str:
    content = msg.get("content")
    if isinstance(content, str) and content:
        return content
    parts = msg.get("parts", [])
    if parts:
        texts = [p.get("text", "") for p in parts if p.get("type") == "text"]
        return "\n".join(texts)
    return ""
```

## Deployment Checklist

Before deploying, verify:

- [ ] `assistantui/package.json` has `"engines": {"node": ">=20.9.0"}`
- [ ] `assistantui/package.json` does NOT have a `"packageManager"` field
- [ ] `assistantui/nixpacks.toml` has `providers = ["node"]`
- [ ] `assistantui/railway.json` exists with `"builder": "NIXPACKS"`
- [ ] Railway dashboard: Root Directory = `/assistantui`
- [ ] Railway dashboard: Config-as-code = `assistantui/railway.json`
- [ ] Railway dashboard: Changes Applied (no pending badge)
- [ ] Backend handles both `content` and `parts` message formats
- [ ] Domain generated for the assistantui service

## Live URLs

| Service | URL |
|---------|-----|
| Backend | https://agent311-production.up.railway.app |
| Vite Frontend | https://frontend-production-893c.up.railway.app |
| assistant-ui Frontend | https://assistantui-production.up.railway.app |
