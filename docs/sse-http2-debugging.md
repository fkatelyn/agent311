# SSE HTTP/2 Protocol Error — Debugging & Fix

## Problem

Browser showed `net::ERR_HTTP2_PROTOCOL_ERROR 200` when receiving long-running SSE streams from the backend. The stream would start fine but get terminated mid-transfer.

- Backend was healthy (confirmed via `curl` directly)
- Worked locally (no CDN in between)
- Only failed when served through Railway's Fastly CDN over HTTP/2

## Root Cause

Railway serves public traffic through Fastly CDN over HTTP/2. Long-lived SSE streams get terminated by the CDN's HTTP/2 framing — the CDN enforces connection limits that cut off the stream before the agent finishes responding.

## Fix

Added a Next.js API route proxy at `agentui/app/api/chat/route.ts`. The browser sends SSE requests to the same-origin Next.js server, which forwards them to the backend over Railway's **internal network** (`http://agent311.railway.internal:8080`). The internal network uses HTTP/1.1 and bypasses the CDN entirely.

- `BACKEND_INTERNAL_URL` env var set on the `agentui` Railway service
- Only `/api/chat` is proxied — all other endpoints are short-lived and work fine over HTTP/2

## Debugging Traces Added (and later removed)

The following instrumentation was added across several commits while diagnosing the issue. All were removed once the proxy fix was confirmed working. Listed here for reference if you ever need to re-add them.

### Frontend: `agentui/components/chat.tsx`

**Fetch response logging:**
```typescript
// After the authFetch call
console.log("[chat] fetch response:", res.status, res.headers.get("content-type"));
```

**Chunk counting / byte logging (first 3 chunks):**
```typescript
let chunkCount = 0;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunkCount++;
  if (chunkCount <= 3) console.log(`[chat] chunk #${chunkCount}: ${value?.length} bytes`);
  // ...
}
```

### Backend: `agent311/agent311/main.py`

**Prompt and context logging (in `_stream_chat`):**
```python
logger.info(f"=== prompt: {prompt[:200]} ===")
logger.info(f"=== context length: {len(context)} chars, messages[:-1] count: {len(messages[:-1])} ===")
```

**Claude CLI stderr hook (in `ClaudeAgentOptions`):**
```python
stderr=lambda line: logger.warning(f"[claude-cli stderr] {line}"),
```

**Agent lifecycle logging (in `_run_agent`):**
```python
logger.info("[agent] creating ClaudeSDKClient...")
logger.info("[agent] sending query...")
logger.info("[agent] waiting for response...")

msg_count = 0
async for message in client.receive_response():
    msg_count += 1
    logger.info(f"[agent] message #{msg_count}: type={type(message).__name__} isinstance_assistant={isinstance(message, AssistantMessage)}")
    if hasattr(message, 'content'):
        logger.info(f"[agent] message #{msg_count} content types: {[type(b).__name__ for b in message.content]}")
    else:
        logger.info(f"[agent] message #{msg_count} attrs: {list(vars(message).keys()) if hasattr(message, '__dict__') else repr(message)[:200]}")
    # ...

logger.info(f"[agent] loop finished. total messages: {msg_count}")
# (in finally block)
logger.info("[agent] done")
```

**Per-message request logging (in `/api/chat` endpoint):**
```python
logger.info(f"=== /api/chat received {len(messages)} messages, session_id={session_id} ===")
for i, msg in enumerate(messages):
    role = msg.get("role", "?")
    text = _extract_text(msg)
    logger.info(f"  msg[{i}] role={role} text={text[:200]}")
```

### Items That Were Kept

- **`X-Accel-Buffering: no`** response header — still useful as defense-in-depth
- **Keepalive mechanism** (SSE comment every 20s) — essential for preventing idle timeout
- **`console.error("[chat] SSE error:", ...)`** — standard error logging
- **`logger.error(...)` in exception handlers** — standard error reporting

## Related Commits

- `aa43d94` — Add browser console logging for SSE debugging
- `c47a603` — Disable proxy buffering for SSE stream (X-Accel-Buffering: no)
- `dbb8705` — Log SDK message types to diagnose empty responses
- `35d118f` — Add agent lifecycle logging, remove PATH diagnostic
- `d87cdd9` — Add startup diagnostics: log claude CLI path and version
