# Deploying Next.js on Railway (Monorepo Subdirectory)

Pitfalls encountered deploying a Next.js frontend as a Railway service in a monorepo with a Python backend at the repo root.

## Config Files

### `package.json` (key fields)

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

**Critical:** The `"engines"` field is how Railpack picks the Node.js version. Without it, the default Node.js version may be too old for Next.js 16.

### `railpack.json`

```json
{
  "$schema": "https://schema.railpack.com",
  "deploy": {
    "startCommand": "npm start"
  }
}
```

Railpack auto-detects Next.js from `package.json` and runs `npm install` → `npm run build` → `npm start` automatically. `NEXT_PUBLIC_API_URL` must be set as an environment variable in the Railway dashboard.

### `railway.json`

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK"
  }
}
```

## Railway Dashboard Setup

These settings **cannot** be configured via MCP tools or CLI — they must be done in the Railway dashboard.

### Step 1: Set Root Directory

1. Go to the service in Railway dashboard
2. **Settings > Source > Root Directory** → set to the frontend subdirectory (e.g. `/agentui`)
3. This tells Railway to only look at files inside that directory for this service

### Step 2: Set Config-as-Code Path

1. **Settings > Source > Config-as-code** → set to the path relative to the **repo root** (e.g. `agentui/railway.json`)
2. This tells Railway to read that file for builder config

### Step 3: Apply Changes

1. After changing settings, Railway shows an **"N changes"** badge
2. You MUST click **Apply** for changes to take effect
3. **Gotcha:** If you don't apply, deploys continue using the old configuration — this is silent and very confusing

### Step 4: Generate Domain

```bash
railway domain
```

Or via MCP:
```
mcp__Railway__generate-domain(workspacePath: "...", service: "<service-name>")
```

## Pitfalls

### 1. Root Directory Not Applied

**Symptom:** Build uses the root config instead of the frontend's `railpack.json`.

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

**Cause:** Default Node.js version is too old.

**Fix:** Add `"engines": {"node": ">=20.9.0"}` to `package.json`. Railpack reads this field and installs the matching version.

### 4. Config-as-Code Path Confusion

**Symptom:** Railway ignores the frontend's `railway.json` and uses the root one instead.

**Cause:** Config-as-code path must be set explicitly in the Railway dashboard. It is relative to the **repo root**, not the service root directory.

**Fix:** Set Config-as-code to `<subdir>/railway.json` in dashboard Settings.

## Deployment Checklist

- [ ] `package.json` has `"engines": {"node": ">=20.9.0"}`
- [ ] `package.json` does NOT have a `"packageManager"` field
- [ ] `railpack.json` exists with `"startCommand": "npm start"`
- [ ] `railway.json` exists with `"builder": "RAILPACK"`
- [ ] Railway dashboard: Root Directory set to the frontend subdirectory
- [ ] Railway dashboard: Config-as-code path set to `<subdir>/railway.json`
- [ ] Railway dashboard: Changes Applied (no pending badge)
- [ ] `NEXT_PUBLIC_API_URL` set as environment variable in Railway dashboard
- [ ] Domain generated
