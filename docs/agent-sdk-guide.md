# Claude Agent SDK Integration Guide

How agent311 uses the Claude Agent SDK to power its chat API with filesystem skills and built-in tools.

## Overview

agent311 uses the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) (`claude-agent-sdk`) to handle chat completions. The SDK provides an agentic loop where Claude autonomously decides when to use tools — we configure which tools are allowed and stream the responses.

The key difference from the raw Anthropic API:
- **Anthropic API**: You define tools as JSON schemas, implement a tool execution loop yourself, and manually pass results back to Claude.
- **Agent SDK**: You configure `allowed_tools` and `setting_sources`, and the SDK handles the entire tool loop automatically — including built-in tools (Read, Write, Bash, WebSearch, etc.) and filesystem skills.

## Architecture

```
Frontend (React) → POST /api/chat → FastAPI → ClaudeSDKClient → Claude Code CLI → Claude API
                                                    ↕
                                          Built-in tools (Read, Write, Bash, etc.)
                                          Filesystem skills (agent311/.claude/skills/)
```

Each chat request:
1. Extracts the latest user message and conversation history
2. Creates a `ClaudeSDKClient` with the system prompt, allowed tools, and skill sources
3. Sends the prompt and streams `AssistantMessage` responses back as SSE

## Dependencies

```toml
# pyproject.toml
dependencies = [
    "claude-agent-sdk",
    "fastapi",
    "uvicorn",
]
```

The Agent SDK requires the Claude Code CLI installed via npm:
```bash
npm install -g @anthropic-ai/claude-code
```

Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Two Ways to Extend agent311

### 1. Built-in Tools (allowed_tools)

The Agent SDK provides built-in tools that you can enable by name. These are the same tools available in Claude Code CLI:

```python
options = ClaudeAgentOptions(
    ...
    allowed_tools=["Skill", "Read", "Write", "Edit", "Bash", "Task", "WebSearch", "WebFetch"],
)
```

| Tool | What it does |
|---|---|
| `Skill` | Load and execute filesystem skills from `.claude/skills/` |
| `Read` | Read files from the filesystem |
| `Write` | Write files to the filesystem |
| `Edit` | Edit existing files with string replacements |
| `Bash` | Execute shell commands |
| `Task` | Launch sub-agents for complex multi-step tasks |
| `WebSearch` | Search the web for real-time information |
| `WebFetch` | Fetch and process content from URLs |

### 2. Filesystem Skills (Skill tool + setting_sources)

Skills are markdown files that give the agent specialized instructions. They live in the `.claude/skills/` directory relative to `cwd` and are auto-discovered when `setting_sources` includes `"project"`.

```
agent311/
├── .claude/
│   └── skills/
│       └── hello-world/
│           └── SKILL.md
├── main.py
└── __init__.py
```

#### Skill file format

Skills use YAML frontmatter + markdown instructions:

```markdown
---
name: hello-world
description: >
  A simple hello world skill for testing the agent311 skill system.
  Use when the user asks to "test skills", "demo skills", or "run hello world skill".
version: 1.0.0
---

# Hello World Skill

This skill demonstrates that agent311 can load and execute skills from its `.claude/skills/` directory.

## Instructions

When this skill is triggered:

1. Greet the user warmly
2. Confirm that the skill system is working
3. Mention that this skill was loaded from `agent311/.claude/skills/hello-world/SKILL.md`
4. List any other available skills if the user asks
```

The `description` field in frontmatter tells the agent when to use the skill. The markdown body contains the instructions the agent follows when the skill is invoked.

## Adding a New Skill

### Step 1: Create the skill directory and file

```bash
mkdir -p agent311/.claude/skills/my-new-skill
```

Create `agent311/.claude/skills/my-new-skill/SKILL.md`:

```markdown
---
name: my-new-skill
description: >
  Description of when to use this skill.
  Use when the user asks to "do something specific".
version: 1.0.0
---

# My New Skill

## Instructions

When this skill is triggered:

1. Do step one
2. Do step two
3. Return results to the user
```

### Step 2: That's it

Skills are auto-discovered from the filesystem. No code changes needed in `main.py` — the `Skill` tool + `setting_sources=["project"]` + `cwd` pointing to `agent311/` handles everything.

### Step 3: Deploy

Commit, push, and deploy to Railway. The skill file just needs to be in the repo.

## Configuring ClaudeAgentOptions

The core configuration that makes everything work:

```python
from pathlib import Path

options = ClaudeAgentOptions(
    system_prompt=system_prompt,
    cwd=str(Path(__file__).parent),          # Points to agent311/ directory
    setting_sources=["project"],              # Loads skills from .claude/skills/ relative to cwd
    allowed_tools=[                           # Tools the agent can use
        "Skill", "Read", "Write", "Edit",
        "Bash", "Task", "WebSearch", "WebFetch",
    ],
    permission_mode="acceptEdits",            # Required for Railway (root user)
    max_turns=5,                              # Limit agentic loop iterations
)
```

Key options:
- **`cwd`**: Working directory for the agent. Skills are discovered relative to this path (at `cwd/.claude/skills/`).
- **`setting_sources`**: Set to `["project"]` to enable filesystem skill loading. Without this, the `Skill` tool won't find any skills.
- **`allowed_tools`**: Whitelist of tools the agent can use. Only listed tools are available.
- **`permission_mode`**: Use `"acceptEdits"` for Railway deployment (see gotchas below).
- **`max_turns`**: Limits how many tool-use rounds the agent can perform per request.

## Integrating with FastAPI Chat API

The full pattern for streaming Agent SDK responses as SSE:

```python
import json
import uuid
from pathlib import Path

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
)

async def _stream_chat(messages: list):
    msg_id = str(uuid.uuid4())

    # Extract the last user message
    prompt = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            prompt = msg.get("content", "")
            break

    # Build conversation context from earlier messages
    context = ""
    for msg in messages[:-1]:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role and content:
            context += f"<{role}>\n{content}\n</{role}>\n\n"

    system_prompt = SYSTEM_PROMPT
    if context:
        system_prompt += f"\n\nConversation history:\n{context}"

    options = ClaudeAgentOptions(
        system_prompt=system_prompt,
        cwd=str(Path(__file__).parent),
        setting_sources=["project"],
        allowed_tools=["Skill", "Read", "Write", "Edit", "Bash", "Task", "WebSearch", "WebFetch"],
        permission_mode="acceptEdits",
        max_turns=5,
    )

    # SSE envelope
    yield f"data: {json.dumps({'type': 'start', 'messageId': msg_id})}\n\n"
    yield f"data: {json.dumps({'type': 'text-start', 'id': msg_id})}\n\n"

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)
            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': block.text})}\n\n"
                        elif isinstance(block, ToolUseBlock):
                            yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': f'[Using tool: {block.name}]\\n'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': f'Error: {str(e)}'})}\n\n"

    yield f"data: {json.dumps({'type': 'text-end', 'id': msg_id})}\n\n"
    yield f"data: {json.dumps({'type': 'finish'})}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    return StreamingResponse(
        _stream_chat(messages),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
        },
    )
```

### Key points

- **`ClaudeSDKClient`** is used (not `query()`) because it supports multi-turn conversation with tools.
- Each request creates a new client/session. Conversation history is passed via the system prompt.
- `AssistantMessage` contains complete text blocks (not token-by-token). The SDK doesn't support `StreamEvent` for incremental streaming in the current version.
- `receive_response()` yields messages until a `ResultMessage` is reached.

## Custom Tools via @tool (Alternative Approach)

If you need programmatic tools (Python functions that execute code), you can use the `@tool` decorator with `create_sdk_mcp_server()`. This is useful for tools that need to call APIs, query databases, or perform computations.

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool(
    "lookup_311_request",
    "Look up an Austin 311 service request by its ID number.",
    {"request_id": str},
)
async def lookup_311_request(args):
    request_id = args.get("request_id", "")
    # Call an API, query a database, etc.
    return {
        "content": [
            {"type": "text", "text": f"Request {request_id}: ..."}
        ]
    }

# Bundle into an MCP server
agent311_tools = create_sdk_mcp_server(name="agent311", tools=[lookup_311_request])

# Register in options
options = ClaudeAgentOptions(
    ...
    mcp_servers={"agent311": agent311_tools},
    allowed_tools=[..., "mcp__agent311__lookup_311_request"],
)
```

Tool names follow the pattern `mcp__<server>__<tool>` when registered via MCP server.

**When to use which:**
- **Filesystem skills** — for instruction-based behaviors (prompts, workflows, guidelines)
- **@tool + MCP server** — for programmatic tools that need to run Python code

agent311 currently uses only filesystem skills and built-in tools. Custom `@tool` tools can be added later when data querying capabilities are needed.

## Skills Separation: agent311 vs Claude Code CLI

These are two completely separate skill directories:

| | Claude Code CLI (your laptop) | agent311 (FastAPI service) |
|---|---|---|
| **Skills location** | `.claude/skills/` (repo root) | `agent311/.claude/skills/` |
| **Loaded by** | Claude Code CLI directly | Agent SDK via `setting_sources=["project"]` |
| **Example** | `railway-deploy` | `hello-world` |
| **Trigger** | You type `/railway-deploy` in CLI | User asks agent311 in chat |

Adding a skill to `.claude/skills/` (repo root) does NOT make it available in agent311, and vice versa.

## Gotchas: Railway Deployment

### `bypassPermissions` fails as root

Railway containers run as root. The Claude Code CLI refuses `--dangerously-skip-permissions` as root for security:

```
--dangerously-skip-permissions cannot be used with root/sudo privileges
```

**Fix**: Use `permission_mode="acceptEdits"` instead.

### Node.js is required

The Agent SDK spawns the Claude Code CLI as a subprocess, which is a Node.js binary. You must include Node.js in your nixpacks setup:

```toml
# nixpacks.toml
[phases.setup]
nixPkgs = ["python312", "gcc", "nodejs-18_x"]

[phases.cli]
dependsOn = ["install"]
cmds = ["npm install -g @anthropic-ai/claude-code"]
```

### `nixPkgsAppend` does not exist

There is no `nixPkgsAppend` key in Nixpacks. If you use it, it's silently ignored and your packages won't be installed. Always use `nixPkgs` with all required packages listed explicitly:

```toml
# Wrong - silently ignored
[phases.setup]
nixPkgsAppend = ["nodejs-18_x"]

# Correct - list all packages
[phases.setup]
nixPkgs = ["python312", "gcc", "nodejs-18_x"]
```

### `StreamEvent` is not exported

The Agent SDK docs reference `StreamEvent` for partial message streaming, but it is NOT exported from `claude_agent_sdk` (as of v0.1.33). Importing it will crash your app at startup:

```python
# This will crash
from claude_agent_sdk import StreamEvent  # ImportError

# Use AssistantMessage instead
from claude_agent_sdk import AssistantMessage, TextBlock
```

Responses come as complete `AssistantMessage` blocks rather than token-by-token deltas.

### Don't override the install phase

Overriding `[phases.install]` in nixpacks.toml breaks Nixpacks' automatic uv detection and installation. Use a separate custom phase instead:

```toml
# Wrong - breaks uv auto-install
[phases.install]
cmds = ["npm install -g @anthropic-ai/claude-code"]

# Correct - separate phase
[phases.cli]
dependsOn = ["install"]
cmds = ["npm install -g @anthropic-ai/claude-code"]
```

### ANTHROPIC_API_KEY must be set

Set it via Railway dashboard or CLI:
```bash
railway variables set ANTHROPIC_API_KEY=sk-ant-...
```

The Agent SDK reads this environment variable automatically.

## Testing Locally

```bash
# Start the server
uv run uvicorn agent311.main:app --reload --host 0.0.0.0 --port 8000

# Test a skill
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Run the hello world skill"}]}'

# Test web search
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Search for latest Austin 311 news"}]}'

# Test regular chat
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is Austin 311?"}]}'
```

## References

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Python SDK Reference](https://platform.claude.com/docs/en/agent-sdk/python)
- [Agent SDK Skills](https://platform.claude.com/docs/en/agent-sdk/skills)
