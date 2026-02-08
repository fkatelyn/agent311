# Claude Agent SDK Integration Guide

How agent311 uses the Claude Agent SDK to power its chat API with custom tools, and how to add new tools.

## Overview

agent311 uses the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) (`claude-agent-sdk`) to handle chat completions. The SDK provides an agentic loop where Claude autonomously decides when to use tools — we just define the tools and stream the responses.

The key difference from the raw Anthropic API:
- **Anthropic API**: You define tools as JSON schemas, implement a tool execution loop yourself, and manually pass results back to Claude.
- **Agent SDK**: You define tools with the `@tool` decorator, register them as an MCP server, and the SDK handles the entire tool loop automatically.

## Architecture

```
Frontend (React) → POST /api/chat → FastAPI → ClaudeSDKClient → Claude Code CLI → Claude API
                                                    ↕
                                          MCP Server (in-process)
                                          └── hello_world tool
```

Each chat request:
1. Extracts the latest user message and conversation history
2. Creates a `ClaudeSDKClient` with the system prompt and tools
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

## Defining Custom Tools

Tools are defined with the `@tool` decorator and bundled into an in-process MCP server using `create_sdk_mcp_server()`.

### Basic tool

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool(
    "hello_world",
    "A simple test tool that returns a greeting message.",
    {"name": str},
)
async def hello_world(args):
    name = args.get("name", "there")
    return {
        "content": [
            {"type": "text", "text": f"Hello, {name}! Tool calling is working!"}
        ]
    }

# Bundle tools into an MCP server
agent311_tools = create_sdk_mcp_server(name="agent311", tools=[hello_world])
```

### Input schema formats

Simple type mapping (recommended):
```python
@tool("my_tool", "Description", {"query": str, "limit": int})
```

JSON Schema (for complex validation):
```python
@tool("my_tool", "Description", {
    "type": "object",
    "properties": {
        "query": {"type": "string"},
        "limit": {"type": "integer", "minimum": 1, "maximum": 100}
    },
    "required": ["query"]
})
```

### Tool return format

Tools must return a dict with a `content` list:
```python
async def my_tool(args):
    return {
        "content": [
            {"type": "text", "text": "Result here"}
        ]
    }
```

For errors:
```python
async def my_tool(args):
    return {
        "content": [
            {"type": "text", "text": "Something went wrong"}
        ],
        "is_error": True
    }
```

## Adding a New Tool

### Step 1: Define the tool

Add your tool definition in `agent311/main.py` alongside existing tools:

```python
@tool(
    "lookup_311_request",
    "Look up an Austin 311 service request by its ID number.",
    {"request_id": str},
)
async def lookup_311_request(args):
    request_id = args.get("request_id", "")
    # Your implementation here
    return {
        "content": [
            {"type": "text", "text": f"Request {request_id}: ..."}
        ]
    }
```

### Step 2: Add to the MCP server

Include the new tool function in the `create_sdk_mcp_server()` call:

```python
agent311_tools = create_sdk_mcp_server(
    name="agent311",
    tools=[hello_world, lookup_311_request]
)
```

### Step 3: Allow the tool

Add the tool to `allowed_tools` in `ClaudeAgentOptions`. Tool names follow the pattern `mcp__<server>__<tool>`:

```python
options = ClaudeAgentOptions(
    ...
    allowed_tools=[
        "mcp__agent311__hello_world",
        "mcp__agent311__lookup_311_request",
    ],
)
```

### Step 4: Deploy

Commit, push, and deploy to Railway. No config changes needed — just the Python code.

## Integrating with FastAPI Chat API

The full pattern for streaming Agent SDK responses as SSE:

```python
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
        mcp_servers={"agent311": agent311_tools},
        allowed_tools=["mcp__agent311__hello_world"],
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

- **`ClaudeSDKClient`** is used (not `query()`) because it supports custom tools and multi-turn conversation.
- Each request creates a new client/session. Conversation history is passed via the system prompt.
- `AssistantMessage` contains complete text blocks (not token-by-token). The SDK doesn't support `StreamEvent` for incremental streaming in the current version.
- `receive_response()` yields messages until a `ResultMessage` is reached.

## Agent SDK vs Workspace Skills

These are two completely separate systems:

| | Workspace Skills | Agent SDK Tools |
|---|---|---|
| **Location** | `.claude/skills/SKILL.md` | Python code (`@tool` decorator) |
| **Used by** | Claude Code CLI on your laptop | agent311 FastAPI service |
| **Format** | Markdown with YAML frontmatter | Python async functions |
| **Registration** | Auto-discovered from filesystem | `create_sdk_mcp_server()` |
| **Example** | `railway-deploy` skill | `hello_world` tool |

Do not mix these up. Adding a file to `.claude/skills/` does NOT make it available in the agent311 chat API, and vice versa.

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

# Test the hello_world tool
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Run the hello_world tool"}]}'
```

## References

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Python SDK Reference](https://platform.claude.com/docs/en/agent-sdk/python)
- [Agent SDK Skills](https://platform.claude.com/docs/en/agent-sdk/skills) (workspace skills, not the same as custom tools)
