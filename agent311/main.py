import json
import os
import uuid

from anthropic import AsyncAnthropic
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Anthropic client
client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

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

Be helpful, accurate, and enthusiastic about Austin's civic data!"""


async def _stream_chat(messages: list):
    """Stream chat responses from Claude API in Vercel AI SDK data stream protocol."""
    msg_id = str(uuid.uuid4())

    # Convert frontend message format to Claude format
    claude_messages = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content") or msg.get("text", "")
        if role and content:
            claude_messages.append({"role": role, "content": content})

    # start
    yield f"data: {json.dumps({'type': 'start', 'messageId': msg_id})}\n\n"
    # text-start
    yield f"data: {json.dumps({'type': 'text-start', 'id': msg_id})}\n\n"

    try:
        # Stream from Claude API
        async with client.messages.stream(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=claude_messages,
        ) as stream:
            async for text in stream.text_stream:
                # Stream each text chunk as text-delta
                yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': text})}\n\n"

    except Exception as e:
        # On error, send error message as text
        error_msg = f"Error: {str(e)}"
        yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': error_msg})}\n\n"

    # text-end
    yield f"data: {json.dumps({'type': 'text-end', 'id': msg_id})}\n\n"
    # finish
    yield f"data: {json.dumps({'type': 'finish'})}\n\n"
    # done
    yield "data: [DONE]\n\n"


@app.get("/")
async def hello():
    return {"message": "Hello, World!"}


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
