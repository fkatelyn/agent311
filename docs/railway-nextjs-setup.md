# Deploying Next.js on Railway (Monorepo)

The frontend (`agentui/`) and backend (`agent311/`) run as **separate Railway services** in the same project:

```
Railway Project
├── agent311          (FastAPI backend)  → <backend>.up.railway.app
└── agentui           (Next.js frontend) → <frontend>.up.railway.app
```

## Config Files

### `agentui/package.json` (key fields)

```json
{
  "private": true,
  "engines": {
    "node": ">=20.9.0"
  },
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start"
  }
}
```

**Critical:** Do NOT include a `"packageManager"` field. Some scaffolders add `"packageManager": "pnpm@..."` which forces Railpack to use pnpm, which then fails without a `pnpm-lock.yaml`.

**Critical:** The `"engines"` field is how Railpack picks the Node.js version. Without it, the default may be too old for Next.js 16.

### `agentui/railpack.json`

```json
{
  "$schema": "https://schema.railpack.com",
  "deploy": {
    "startCommand": "npm start"
  }
}
```

Railpack auto-detects Next.js from `package.json` and runs `npm install` → `npm run build` → `npm start` automatically.

### `agentui/railway.json`

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK"
  }
}
```

## Railway Dashboard Setup

These settings **cannot** be configured via the Railway CLI — they must be done in the Railway dashboard.

### Step 1: Set Root Directory

1. Go to the `agentui` service in Railway dashboard
2. **Settings > Source > Root Directory** → set to `/agentui`
3. This tells Railway to only look at files inside that directory for this service

### Step 2: Set Config-as-Code Path

1. **Settings > Source > Config-as-code** → set to `agentui/railway.json`
2. This path is relative to the **repo root**, not the service root directory

### Step 3: Apply Changes

1. After changing settings, Railway shows an **"N changes"** badge
2. You MUST click **Apply** for changes to take effect
3. **Gotcha:** If you don't apply, deploys continue using the old configuration — this is silent and very confusing

### Step 4: Set Environment Variables

Set `NEXT_PUBLIC_API_URL` to the backend service URL in the Railway dashboard. Unlike Vite, Next.js can read `NEXT_PUBLIC_*` vars at build time from the Railway dashboard directly — no `.env.production` file needed.

### Step 5: Generate Domain

```bash
railway domain
```

## Backend CORS

The FastAPI backend must allow cross-origin requests from the frontend domain. This is already configured in `agent311/agent311/main.py` with `allow_origins=["*"]`.

## Local Development

```bash
cd agentui
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `agentui/.env.local` (not committed). Make sure the FastAPI backend is also running:

```bash
cd agent311
uv run uvicorn agent311.main:app --host 0.0.0.0 --port 8000 --reload
```

## Pitfalls

### 1. Root Directory Not Applied

**Symptom:** Build uses the root config instead of `agentui/railpack.json`.

**Cause:** Root directory was set in the Railway dashboard but not Applied.

**Fix:** Always click Apply after making any dashboard settings changes.

### 2. pnpm Frozen Lockfile Error

**Symptom:**
```
ERR_PNPM_NO_LOCKFILE Cannot install with "frozen-lockfile" because pnpm-lock.yaml is absent
```

**Cause:** `"packageManager": "pnpm@..."` in `package.json`. Railpack detects this and uses pnpm, which fails without a lockfile.

**Fix:** Remove the `"packageManager"` field from `package.json`.

### 3. Node.js Too Old for Next.js 16

**Symptom:**
```
You are using Node.js 18.20.5. For Next.js, Node.js version ">=20.9.0" is required.
```

**Fix:** Add `"engines": {"node": ">=20.9.0"}` to `package.json`. Railpack reads this field and installs the matching version.

### 4. Config-as-Code Path Confusion

**Symptom:** Railway ignores `agentui/railway.json` and uses the root one instead.

**Cause:** Config-as-code path must be set explicitly in the Railway dashboard, relative to the **repo root**.

**Fix:** Set Config-as-code to `agentui/railway.json` in dashboard Settings.

### 5. CORS Error in Browser Console

**Cause:** Backend missing CORS middleware, or `allow_origins` doesn't include the frontend domain.

**Fix:** Ensure `CORSMiddleware` is configured in `agent311/agent311/main.py`.

## Deployment Checklist

- [ ] `package.json` has `"engines": {"node": ">=20.9.0"}`
- [ ] `package.json` does NOT have a `"packageManager"` field
- [ ] `railpack.json` exists with `"startCommand": "npm start"`
- [ ] `railway.json` exists with `"builder": "RAILPACK"`
- [ ] Railway dashboard: Root Directory set to `/agentui`
- [ ] Railway dashboard: Config-as-code path set to `agentui/railway.json`
- [ ] Railway dashboard: Changes Applied (no pending badge)
- [ ] `NEXT_PUBLIC_API_URL` set as environment variable in Railway dashboard
- [ ] Domain generated
