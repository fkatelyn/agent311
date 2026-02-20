import base64
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
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
from fastapi import Depends, FastAPI, HTTPException, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agent311.auth import (
    create_token,
    get_current_user,
    verify_credentials,
)
from agent311.db import (
    Message,
    Session,
    create_tables,
    get_async_session,
    get_db,
)


_volume_mount = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", "/tmp/agent311_data")
REPORTS_DIR = Path(_volume_mount) / "reports"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    logger.info("Database tables created")
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Reports directory ready: {REPORTS_DIR}")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_PATH = Path(_volume_mount) / "311_recent.csv"

SYSTEM_PROMPT = f"""You are Agent 311, an AI assistant specializing in Austin 311 service request data.

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

You have a local CSV file at {CSV_PATH} containing the past 7 days of 311 service requests, downloaded fresh on startup. Use the Read tool to access this file when users ask about recent 311 data. The CSV columns are: sr_number, sr_type_desc, sr_department_desc, sr_method_received_desc, sr_status_desc, sr_status_date, sr_created_date, sr_updated_date, sr_closed_date, sr_location, sr_location_street_number, sr_location_street_name, sr_location_city, sr_location_zip_code, sr_location_county, sr_location_x, sr_location_y, sr_location_lat, sr_location_long, sr_location_lat_long, sr_location_council_district, sr_location_map_page, sr_location_map_tile.

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
    ".png": "png",
    ".csv": "csv",
}
VIEWABLE_ROOTS = (Path("/tmp").resolve(), Path(_volume_mount).resolve())
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

    result = {
        "path": str(file_path),
        "language": VIEWABLE_EXTENSIONS[ext],
        "sizeBytes": size_bytes,
    }

    if ext == ".png":
        result["content"] = base64.b64encode(file_path.read_bytes()).decode("ascii")
        result["encoding"] = "base64"
    else:
        result["content"] = file_path.read_text(encoding="utf-8", errors="replace")

    return result


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


ALLOWED_REPORT_EXTENSIONS = {".html", ".png", ".csv", ".pdf"}
ALLOWED_UPLOAD_EXTENSIONS = {".html", ".pdf"}


@tool(
    "save_report",
    "Save an agent-generated report (HTML, PNG, or CSV) to the reports directory for user access.",
    {"filename": str, "content": str, "encoding": str},
)
async def save_report(args: dict):
    filename = str(args.get("filename", "")).strip()
    content = str(args.get("content", ""))
    encoding = str(args.get("encoding", "text")).strip().lower()

    if not filename:
        return {"content": [{"type": "text", "text": "Error: filename is required."}]}

    # Sanitize: no path traversal
    safe_name = Path(filename).name
    if not safe_name or safe_name != filename or ".." in filename or "/" in filename:
        return {"content": [{"type": "text", "text": f"Error: invalid filename '{filename}'. Use a simple name like 'report.html'."}]}

    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_REPORT_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_REPORT_EXTENSIONS))
        return {"content": [{"type": "text", "text": f"Error: unsupported extension '{ext}'. Allowed: {allowed}"}]}

    file_path = REPORTS_DIR / safe_name

    if encoding == "base64":
        data = base64.b64decode(content)
        file_path.write_bytes(data)
    else:
        file_path.write_text(content, encoding="utf-8")

    size = file_path.stat().st_size
    return {"content": [{"type": "text", "text": f"Report saved: {file_path} ({size} bytes)"}]}


agent311_host_tools = create_sdk_mcp_server(
    name="agent311_host",
    tools=[view_content, save_report],
)


def _extract_text(msg: dict) -> str:
    """Extract text from a message, supporting both formats:
    - Old format: {"role": "user", "content": "hello"}
    - AI SDK v6:  {"role": "user", "parts": [{"type": "text", "text": "hello"}]}
    """
    content = msg.get("content")
    if isinstance(content, str) and content:
        return content

    parts = msg.get("parts", [])
    if parts:
        texts = []
        for part in parts:
            if isinstance(part, dict) and part.get("type") == "text":
                texts.append(part.get("text", ""))
        return "\n".join(texts)

    return ""


async def _stream_chat(messages: list, session_id: str | None, user_msg_id: str | None, assistant_msg_id: str | None):
    """Stream chat responses using Claude Agent SDK. Persists messages to DB."""
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
            "mcp__agent311_host__save_report",
        ],
        permission_mode="acceptEdits",
        max_turns=60,
    )

    # SSE stream
    yield f"data: {json.dumps({'type': 'start', 'messageId': msg_id})}\n\n"
    yield f"data: {json.dumps({'type': 'text-start', 'id': msg_id})}\n\n"

    full_text = ""
    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)
            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            full_text += block.text
                            yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': block.text})}\n\n"
                        elif isinstance(block, ToolUseBlock):
                            if block.name == "mcp__agent311_host__view_content":
                                block_input = block.input if isinstance(block.input, dict) else {}
                                path_value = block_input.get("path")
                                if isinstance(path_value, str) and path_value.strip():
                                    marker = f"[Using tool: view_content {path_value}]\\n"
                                    full_text += marker
                                    yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': marker})}\n\n"
                                    continue
                            if block.name == "mcp__agent311_host__save_report":
                                block_input = block.input if isinstance(block.input, dict) else {}
                                fname = block_input.get("filename", "")
                                if isinstance(fname, str) and fname.strip():
                                    marker = f"[Using tool: save_report {fname}]\\n"
                                    full_text += marker
                                    yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': marker})}\n\n"
                                    continue
                            tool_marker = f"[Using tool: {block.name}]\\n"
                            full_text += tool_marker
                            yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': tool_marker})}\n\n"
    except Exception as e:
        error_text = f"Error: {str(e)}"
        full_text += error_text
        yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': error_text})}\n\n"

    yield f"data: {json.dumps({'type': 'text-end', 'id': msg_id})}\n\n"
    yield f"data: {json.dumps({'type': 'finish'})}\n\n"
    yield "data: [DONE]\n\n"

    # Persist assistant message to DB after streaming completes
    if session_id and full_text:
        try:
            async with get_async_session()() as db:
                db_msg = Message(
                    id=assistant_msg_id or str(uuid.uuid4()),
                    session_id=session_id,
                    role="assistant",
                    content=full_text,
                )
                db.add(db_msg)
                # Update session timestamp
                result = await db.execute(select(Session).where(Session.id == session_id))
                sess = result.scalar_one_or_none()
                if sess:
                    sess.updated_at = datetime.now(timezone.utc)
                await db.commit()
        except Exception:
            logger.exception("Failed to save assistant message to DB")


# ─── Auth endpoint ───────────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    if not verify_credentials(body.email, body.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(body.email)
    return {"token": token}


# ─── Session CRUD endpoints ─────────────────────────────────────────────────


class CreateSessionRequest(BaseModel):
    id: str
    title: str = "New Chat"


class UpdateSessionRequest(BaseModel):
    title: str | None = None
    is_favorite: bool | None = None


@app.get("/api/sessions")
async def list_sessions(
    user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).order_by(Session.is_favorite.desc(), Session.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "createdAt": s.created_at.isoformat() if s.created_at else None,
            "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
            "isFavorite": s.is_favorite,
        }
        for s in sessions
    ]


@app.get("/api/sessions/{session_id}")
async def get_session(
    session_id: str,
    user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.messages))
        .where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": session.id,
        "title": session.title,
        "createdAt": session.created_at.isoformat() if session.created_at else None,
        "updatedAt": session.updated_at.isoformat() if session.updated_at else None,
        "isFavorite": session.is_favorite,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "createdAt": m.created_at.isoformat() if m.created_at else None,
            }
            for m in session.messages
        ],
    }


@app.post("/api/sessions")
async def create_session_endpoint(
    body: CreateSessionRequest,
    user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = Session(id=body.id, title=body.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "createdAt": session.created_at.isoformat() if session.created_at else None,
        "updatedAt": session.updated_at.isoformat() if session.updated_at else None,
        "isFavorite": session.is_favorite,
    }


@app.patch("/api/sessions/{session_id}")
async def update_session(
    session_id: str,
    body: UpdateSessionRequest,
    user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if body.title is not None:
        session.title = body.title
    if body.is_favorite is not None:
        session.is_favorite = body.is_favorite
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@app.patch("/api/messages/{message_id}")
async def update_message(
    message_id: str,
    body: dict,
    user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if "content" in body:
        message.content = body["content"]
    await db.commit()
    return {"ok": True}


@app.delete("/api/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"ok": True}


# ─── Reports endpoint ───────────────────────────────────────────────────────


@app.get("/api/reports")
async def list_reports(user: str = Depends(get_current_user)):
    if not REPORTS_DIR.exists():
        return {"files": []}

    files = []
    for f in REPORTS_DIR.iterdir():
        if f.is_file() and f.suffix.lower() in ALLOWED_REPORT_EXTENSIONS:
            stat = f.stat()
            files.append({
                "name": f.name,
                "path": str(f),
                "type": f.suffix.lstrip(".").lower(),
                "sizeBytes": stat.st_size,
                "modifiedAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })

    files.sort(key=lambda x: x["modifiedAt"], reverse=True)
    return {"files": files}


DOWNLOAD_MEDIA_TYPES = {
    ".html": "text/html",
    ".htm": "text/html",
    ".png": "image/png",
    ".csv": "text/csv",
    ".pdf": "application/pdf",
}


@app.get("/api/reports/download")
async def download_report(
    path: str = Query(..., description="Absolute path to report file"),
    user: str = Depends(get_current_user),
):
    try:
        file_path = Path(path).resolve(strict=True)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Not a file")

    if not file_path.is_relative_to(REPORTS_DIR.resolve()):
        raise HTTPException(status_code=403, detail="File is outside reports directory")

    ext = file_path.suffix.lower()
    if ext not in ALLOWED_REPORT_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    media_type = DOWNLOAD_MEDIA_TYPES.get(ext, "application/octet-stream")
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=file_path.name,
    )


@app.delete("/api/reports/{filename}")
async def delete_report(
    filename: str,
    user: str = Depends(get_current_user),
):
    safe_name = Path(filename).name
    if not safe_name or safe_name != filename or ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail=f"Invalid filename: {filename}")

    file_path = (REPORTS_DIR / safe_name).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if not file_path.is_relative_to(REPORTS_DIR.resolve()):
        raise HTTPException(status_code=403, detail="File is outside reports directory")

    file_path.unlink()
    return {"ok": True}


@app.post("/api/reports/upload")
async def upload_report(
    file: UploadFile = File(...),
    user: str = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    safe_name = Path(file.filename).name
    if not safe_name or safe_name != file.filename or ".." in file.filename or "/" in file.filename:
        raise HTTPException(status_code=400, detail=f"Invalid filename: {file.filename}")

    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_UPLOAD_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {allowed}")

    file_path = REPORTS_DIR / safe_name
    content = await file.read()
    file_path.write_bytes(content)

    stat = file_path.stat()
    return {
        "name": safe_name,
        "path": str(file_path),
        "type": ext.lstrip("."),
        "sizeBytes": stat.st_size,
        "modifiedAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    }


# ─── Existing endpoints ─────────────────────────────────────────────────────


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
async def chat(
    request: Request,
    user: str = Depends(get_current_user),
):
    body = await request.json()
    messages = body.get("messages", [])
    session_id = body.get("session_id")
    user_msg_id = body.get("user_msg_id")
    assistant_msg_id = body.get("assistant_msg_id")

    logger.info(f"=== /api/chat received {len(messages)} messages, session_id={session_id} ===")
    for i, msg in enumerate(messages):
        role = msg.get("role", "?")
        text = _extract_text(msg)
        logger.info(f"  msg[{i}] role={role} text={text[:200]}")

    # Persist user message and auto-create session if needed
    if session_id:
        try:
            async with get_async_session()() as db:
                # Auto-create session if it doesn't exist
                result = await db.execute(select(Session).where(Session.id == session_id))
                sess = result.scalar_one_or_none()
                if not sess:
                    sess = Session(id=session_id, title="New Chat")
                    db.add(sess)

                # Save user message
                if user_msg_id and messages:
                    last_user = None
                    for msg in reversed(messages):
                        if msg.get("role") == "user":
                            last_user = msg
                            break
                    if last_user:
                        db_msg = Message(
                            id=user_msg_id,
                            session_id=session_id,
                            role="user",
                            content=_extract_text(last_user),
                        )
                        db.add(db_msg)

                await db.commit()
        except Exception:
            logger.exception("Failed to save user message to DB")

    return StreamingResponse(
        _stream_chat(messages, session_id, user_msg_id, assistant_msg_id),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
        },
    )
