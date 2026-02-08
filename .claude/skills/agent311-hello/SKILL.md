---
name: agent311-hello
description: >
  A simple hello world skill demonstrating Claude Code SDK integration with agent311.
  Use when the user asks to "test agent311", "demo agent311 skill", or wants to see
  how skills work with the agent311 API.
version: 1.0.0
---

# Agent311 Hello World Skill

This is a demonstration skill showing how to integrate with the agent311 chat API using Claude Code SDK.

## What This Skill Does

1. Makes a test request to the agent311 chat API
2. Demonstrates SSE streaming response parsing
3. Shows how to use environment variables
4. Validates the Claude API integration

## Usage

When the user invokes this skill, perform these steps:

### Step 1: Check Environment

Verify the required environment variables are set:

```bash
# Check if ANTHROPIC_API_KEY is set
echo $ANTHROPIC_API_KEY | head -c 20
```

If not set:
- Local: Check `.env` file exists and has `ANTHROPIC_API_KEY`
- Railway: Verify with `railway variables | grep ANTHROPIC`

### Step 2: Test Local Backend

Send a test message to the local development server:

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello! Tell me about Austin 311."}
    ]
  }'
```

Expected response: SSE stream with Claude-powered responses about Austin 311.

### Step 3: Test Production Backend

Send a test message to the Railway deployment:

```bash
curl -X POST https://agent311-production.up.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What are the most common 311 request types?"}
    ]
  }'
```

### Step 4: Parse SSE Response

The response comes as Server-Sent Events (SSE). Key event types:

```
data: {"type":"start","messageId":"..."}
data: {"type":"text-start","id":"..."}
data: {"type":"text-delta","id":"...","delta":"Hello"}
data: {"type":"text-delta","id":"...","delta":" there"}
data: {"type":"text-end","id":"..."}
data: {"type":"finish"}
data: [DONE]
```

Extract just the text content by filtering for `text-delta` events.

### Step 5: Verify Integration

Confirm the following:
- ✅ Claude API responds (not dummy data)
- ✅ Responses are about Austin 311 data
- ✅ Streaming works (text-delta events)
- ✅ No API errors (check for error messages)

## Example Output

**Successful Response:**
```
Starting Container
 INFO  Accepting connections at http://localhost:8000

data: {"type":"start","messageId":"abc-123"}
data: {"type":"text-start","id":"abc-123"}
data: {"type":"text-delta","id":"abc-123","delta":"Hello"}
data: {"type":"text-delta","id":"abc-123","delta":"!"}
data: {"type":"text-delta","id":"abc-123","delta":" I'm"}
data: {"type":"text-delta","id":"abc-123","delta":" Agent"}
data: {"type":"text-delta","id":"abc-123","delta":" 311"}
...
data: {"type":"text-end","id":"abc-123"}
data: {"type":"finish"}
data: [DONE]
```

## Troubleshooting

**Error: "ANTHROPIC_API_KEY not set"**
- Local: Add key to `.env` file
- Railway: Run `railway variables set ANTHROPIC_API_KEY=sk-ant-...`

**Error: Connection refused**
- Local: Start server with `uv run uvicorn agent311.main:app --reload --host 0.0.0.0 --port 8000`
- Railway: Check deployment status with `railway logs`

**Error: "Invalid API key"**
- Verify key is correct at https://console.anthropic.com/settings/keys
- Check for extra spaces or quotes in `.env` file

## Advanced: Testing with Python

```python
import os
import httpx
import json

async def test_agent311():
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            "http://localhost:8000/api/chat",
            json={"messages": [{"role": "user", "content": "Hello!"}]},
            timeout=30.0
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        event = json.loads(data)
                        if event.get("type") == "text-delta":
                            print(event.get("delta"), end="", flush=True)
                    except:
                        pass
```

## Success Criteria

The skill succeeds when:
1. ✅ API responds with SSE stream
2. ✅ Response contains intelligent Austin 311 information
3. ✅ No error messages in stream
4. ✅ Both local and production endpoints work

Report results to the user with:
- Response preview (first 100 chars)
- Confirmation that Claude API is working
- Any issues encountered
