import json
import logging
import uuid
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    create_sdk_mcp_server,
    tool,
)
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """You are Agent 311, an AI assistant specializing in Austin 311 service request data.

You help users explore and analyze Austin's 311 service requests, which include:
- Code Compliance (overgrown vegetation, junk vehicles, illegal dumping)
- Austin Resource Recovery (missed collection, recycling, bulk items)
- Transportation & Public Works (potholes, street lights, traffic signals)
- Animal Services (stray animals, wildlife, barking dogs)
- Austin Water (water leaks, pressure issues, billing)
- Other city services (parks, libraries, health, development)

The 311 dataset contains ~7.8M service requests from 2014-present, available via the City of Austin Open Data Portal (data.austintexas.gov). Data is updated in real-time with 1,500-2,000 new requests daily.

Key fields include: service request number, type, description, status, created/close dates, location, coordinates, and council district.

You can discuss:
- How to use Austin 311 (call 3-1-1, web at 311.austin.gov, mobile app)
- Common request types and response times
- Data trends and statistics
- How to access the public dataset via Socrata API

You have a local CSV file at /tmp/agent311_data/311_recent.csv containing the past 7 days of 311 service requests, downloaded fresh on startup. Use the Read tool to access this file when users ask about recent 311 data. The CSV columns are: sr_number, sr_type_desc, sr_department_desc, sr_method_received_desc, sr_status_desc, sr_status_date, sr_created_date, sr_updated_date, sr_closed_date, sr_location, sr_location_street_number, sr_location_street_name, sr_location_city, sr_location_zip_code, sr_location_county, sr_location_x, sr_location_y, sr_location_lat, sr_location_long, sr_location_lat_long, sr_location_council_district, sr_location_map_page, sr_location_map_tile.

For older data or complex queries, use the Socrata API: https://data.austintexas.gov/resource/xwdj-i9he.csv (or .json). Use $where, $limit, $order, $select, $group parameters.

Be helpful, accurate, and enthusiastic about Austin's civic data!"""

VIEWABLE_EXTENSIONS = {
    ".html": "html",
    ".htm": "html",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "jsx",
    ".tsx": "tsx",
}
VIEWABLE_ROOTS = (Path("/tmp").resolve(),)
MAX_VIEWABLE_BYTES = 200_000


def _normalize_path(path_value: str) -> str:
    return path_value.strip().strip('"').strip("'")


def _load_viewable_file(path_value: str) -> dict:
    normalized = _normalize_path(path_value)
    if not normalized:
        raise ValueError("`path` is required.")

    try:
        file_path = Path(normalized).expanduser().resolve(strict=True)
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"File not found: {normalized}") from exc

    if not file_path.is_file():
        raise ValueError(f"Path is not a file: {file_path}")

    ext = file_path.suffix.lower()
    if ext not in VIEWABLE_EXTENSIONS:
        allowed = ", ".join(sorted(VIEWABLE_EXTENSIONS))
        raise ValueError(f"Unsupported file type for preview. Allowed: {allowed}")

    if not any(file_path.is_relative_to(root) for root in VIEWABLE_ROOTS):
        allowed_roots = ", ".join(str(root) for root in VIEWABLE_ROOTS)
        raise PermissionError(
            f"Path is outside allowed roots ({allowed_roots}): {file_path}"
        )

    size_bytes = file_path.stat().st_size
    if size_bytes > MAX_VIEWABLE_BYTES:
        raise ValueError(
            f"File is too large for preview ({size_bytes} bytes > {MAX_VIEWABLE_BYTES})."
        )

    return {
        "path": str(file_path),
        "language": VIEWABLE_EXTENSIONS[ext],
        "sizeBytes": size_bytes,
        "content": file_path.read_text(encoding="utf-8", errors="replace"),
    }


@tool(
    "view_content",
    "Prepare local HTML/JS content for host-side artifact preview.",
    {"path": str},
)
async def view_content(args: dict):
    path_value = str(args.get("path", "")).strip()
    try:
        file_info = _load_viewable_file(path_value)
        text = (
            f"Prepared artifact preview content for {file_info['path']} "
            f"({file_info['language']}, {file_info['sizeBytes']} bytes)."
        )
    except (FileNotFoundError, PermissionError, ValueError) as exc:
        text = f"Unable to prepare preview: {exc}"

    return {"content": [{"type": "text", "text": text}]}


agent311_host_tools = create_sdk_mcp_server(
    name="agent311_host",
    tools=[view_content],
)


def _extract_text(msg: dict) -> str:
    """Extract text from a message, supporting both formats:
    - Old format: {"role": "user", "content": "hello"}
    - AI SDK v6:  {"role": "user", "parts": [{"type": "text", "text": "hello"}]}
    """
    # Try "content" first (old frontend / simple format)
    content = msg.get("content")
    if isinstance(content, str) and content:
        return content

    # Try "parts" array (AI SDK v6 UIMessage format)
    parts = msg.get("parts", [])
    if parts:
        texts = []
        for part in parts:
            if isinstance(part, dict) and part.get("type") == "text":
                texts.append(part.get("text", ""))
        return "\n".join(texts)

    return ""


async def _stream_chat(messages: list):
    """Stream chat responses using Claude Agent SDK."""
    msg_id = str(uuid.uuid4())

    # Extract the last user message as the prompt
    prompt = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            prompt = _extract_text(msg)
            break

    # Build conversation context from earlier messages
    context = ""
    for msg in messages[:-1]:
        role = msg.get("role", "")
        content = _extract_text(msg)
        if role and content:
            context += f"<{role}>\n{content}\n</{role}>\n\n"

    system_prompt = SYSTEM_PROMPT
    if context:
        system_prompt += f"\n\nConversation history:\n{context}"
    logger.info(f"=== prompt: {prompt[:200]} ===")
    logger.info(f"=== context length: {len(context)} chars, messages[:-1] count: {len(messages[:-1])} ===")

    options = ClaudeAgentOptions(
        system_prompt=system_prompt,
        cwd=str(Path(__file__).parent),
        setting_sources=["project"],
        mcp_servers={"agent311_host": agent311_host_tools},
        allowed_tools=[
            "Skill",
            "Read",
            "Write",
            "Edit",
            "Bash",
            "Task",
            "WebSearch",
            "WebFetch",
            "mcp__agent311_host__view_content",
        ],
        permission_mode="acceptEdits",
        max_turns=60,
    )

    # SSE stream
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
                            if block.name == "mcp__agent311_host__view_content":
                                block_input = block.input if isinstance(block.input, dict) else {}
                                path_value = block_input.get("path")
                                if isinstance(path_value, str) and path_value.strip():
                                    marker = f"[Using tool: view_content {path_value}]\\n"
                                    yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': marker})}\n\n"
                                    continue
                            yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': f'[Using tool: {block.name}]\\n'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': f'Error: {str(e)}'})}\n\n"

    yield f"data: {json.dumps({'type': 'text-end', 'id': msg_id})}\n\n"
    yield f"data: {json.dumps({'type': 'finish'})}\n\n"
    yield "data: [DONE]\n\n"


@app.get("/")
async def hello():
    return {"message": "Hello, World!"}


@app.get("/api/fetch_file")
async def fetch_file(path: str = Query(..., description="Absolute path to a previewable file")):
    try:
        return _load_viewable_file(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    logger.info(f"=== /api/chat received {len(messages)} messages ===")
    for i, msg in enumerate(messages):
        role = msg.get("role", "?")
        text = _extract_text(msg)
        logger.info(f"  msg[{i}] role={role} text={text[:200]}")
    return StreamingResponse(
        _stream_chat(messages),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
        },
    )
