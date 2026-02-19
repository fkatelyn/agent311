# Railway MCP Tool Reference

Complete reference for all 14 Railway MCP tools available via the Railway MCP server.

> Every tool is invoked as `mcp__Railway__<tool-name>`. Parameters marked **required** must always be provided.

---

## check-railway-status

Check whether the Railway CLI is installed and if the user is logged in.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | No parameters needed |

**Example:**
```
mcp__Railway__check-railway-status()
```

**Returns:** CLI version, login status, and linked project/environment info.

---

## create-project-and-link

Create a new Railway project and link it to a local directory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectName` | string | yes | Name for the new project |
| `workspacePath` | string | yes | Local directory path to link the project to |

**Example:**
```
mcp__Railway__create-project-and-link(
  projectName: "my-app",
  workspacePath: "/path/to/repo"
)
```

---

## create-environment

Create a new Railway environment for the currently linked project. Optionally duplicate an existing environment and set service variables.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory path |
| `environmentName` | string | yes | Name for the new environment |
| `duplicateEnvironment` | string | no | Name of existing environment to duplicate |
| `serviceVariables` | array | no | Service variables to assign (only when duplicating). Each item: `{ service: string, variable: string }` |

**Example:**
```
mcp__Railway__create-environment(
  workspacePath: "/path/to/repo",
  environmentName: "staging",
  duplicateEnvironment: "production",
  serviceVariables: [
    { service: "backend", variable: "NODE_ENV=staging" }
  ]
)
```

---

## deploy

Upload and deploy from a local directory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory to deploy |
| `service` | string | no | Service to deploy to (defaults to linked service) |
| `environment` | string | no | Environment to deploy to (defaults to linked environment) |
| `ci` | boolean | no | Stream build logs only, then exit |

**Example:**
```
mcp__Railway__deploy(
  workspacePath: "/path/to/repo",
  service: "agent311"
)
```

---

## deploy-template

Search and deploy Railway templates using fuzzy search.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory to deploy the template to |
| `searchQuery` | string | yes | Search query to filter templates |
| `templateIndex` | number | no | Index of template to deploy (required if multiple matches) |
| `teamId` | string | no | Team ID (optional) |

**Example:**
```
mcp__Railway__deploy-template(
  workspacePath: "/path/to/repo",
  searchQuery: "postgres"
)
```

---

## generate-domain

Generate a public domain for a Railway service. Returns existing domain if one already exists.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory path |
| `service` | string | no | Service name to generate domain for |

**Example:**
```
mcp__Railway__generate-domain(
  workspacePath: "/path/to/repo",
  service: "agent311"
)
```

**Returns:** Public URL like `https://agent311-production.up.railway.app`

---

## get-logs

Get build or deployment logs for a Railway service.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory path |
| `logType` | `"build"` \| `"deploy"` | yes | Type of logs to retrieve |
| `service` | string | no | Service name (defaults to linked service) |
| `environment` | string | no | Environment (defaults to linked environment) |
| `deploymentId` | string | no | Specific deployment ID (defaults to latest) |
| `lines` | number | no | Number of log lines to return (disables streaming). Requires CLI v4.9.0+ |
| `filter` | string | no | Filter logs by terms/attributes (e.g., `@level:error`). Requires CLI v4.9.0+ |
| `json` | boolean | no | Return structured JSON data with timestamps. Uses more tokens. Default: false |

**Example — build logs:**
```
mcp__Railway__get-logs(
  workspacePath: "/path/to/repo",
  logType: "build",
  service: "agent311",
  lines: 50
)
```

**Example — filtered deploy logs:**
```
mcp__Railway__get-logs(
  workspacePath: "/path/to/repo",
  logType: "deploy",
  filter: "@level:error",
  lines: 100
)
```

---

## link-environment

Link to a specific Railway environment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory path |
| `environmentName` | string | yes | Environment name to link to |

**Example:**
```
mcp__Railway__link-environment(
  workspacePath: "/path/to/repo",
  environmentName: "production"
)
```

---

## link-service

Link a service to the current Railway project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory path |
| `serviceName` | string | no | Service name to link. If omitted, lists available services |

**Example:**
```
mcp__Railway__link-service(
  workspacePath: "/path/to/repo",
  serviceName: "agent311"
)
```

---

## list-deployments

List deployments for a Railway service with IDs, statuses, and metadata. Requires CLI v4.10.0+.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory path |
| `service` | string | no | Service name or ID (defaults to linked service) |
| `environment` | string | no | Environment (defaults to linked environment) |
| `limit` | number | no | Max deployments to show (default: 20, max: 1000) |
| `json` | boolean | no | Return structured JSON data with IDs and metadata. Default: false |

**Example:**
```
mcp__Railway__list-deployments(
  workspacePath: "/path/to/repo",
  service: "agent311",
  json: true,
  limit: 5
)
```

---

## list-projects

List all Railway projects for the currently logged-in account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | No parameters needed |

**Example:**
```
mcp__Railway__list-projects()
```

---

## list-services

List all services for the currently linked Railway project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory path |

**Example:**
```
mcp__Railway__list-services(
  workspacePath: "/path/to/repo"
)
```

---

## list-variables

Show environment variables for the active environment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory path |
| `service` | string | no | Service name |
| `environment` | string | no | Environment name |
| `json` | boolean | no | Output in JSON format |
| `kv` | boolean | no | Output in key=value format |

**Example:**
```
mcp__Railway__list-variables(
  workspacePath: "/path/to/repo",
  service: "agent311",
  kv: true
)
```

---

## set-variables

Set environment variables for a service in the active environment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspacePath` | string | yes | Local directory path |
| `variables` | string[] | yes | Array of `KEY=VALUE` pairs |
| `service` | string | no | Service name |
| `environment` | string | no | Environment name |
| `skipDeploys` | boolean | no | Skip triggering deploys when setting variables |

**Example:**
```
mcp__Railway__set-variables(
  workspacePath: "/path/to/repo",
  variables: [
    "ANTHROPIC_API_KEY=sk-ant-...",
    "JWT_SECRET=your-secret"
  ],
  service: "agent311"
)
```

---

## Quick Reference Table

| Tool | Purpose | Key Required Params |
|------|---------|-------------------|
| `check-railway-status` | Verify CLI + login | — |
| `create-project-and-link` | New project | `projectName`, `workspacePath` |
| `create-environment` | New environment | `environmentName`, `workspacePath` |
| `deploy` | Push code to Railway | `workspacePath` |
| `deploy-template` | Deploy a template | `searchQuery`, `workspacePath` |
| `generate-domain` | Create public URL | `workspacePath` |
| `get-logs` | View build/deploy logs | `workspacePath`, `logType` |
| `link-environment` | Switch environment | `environmentName`, `workspacePath` |
| `link-service` | Switch linked service | `workspacePath` |
| `list-deployments` | Show deployment history | `workspacePath` |
| `list-projects` | Show all projects | — |
| `list-services` | Show project services | `workspacePath` |
| `list-variables` | Show env vars | `workspacePath` |
| `set-variables` | Set env vars | `workspacePath`, `variables` |
