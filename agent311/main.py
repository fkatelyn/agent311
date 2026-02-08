import asyncio
import json
import uuid

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

DUMMY_RESPONSES = [
    "I'm Agent 311, your Austin 311 data assistant! I can help you explore service requests, "
    "response times, and trends across Austin. What would you like to know?",
    "Austin 311 handles everything from pothole repairs to animal control. "
    "Last month there were over 50,000 service requests filed across the city.",
    "The most common 311 request categories in Austin are: "
    "Code Compliance, Austin Resource Recovery, and Transportation & Public Works.",
    "Average response time for 311 requests in Austin varies by department, "
    "but most non-emergency requests are addressed within 3-5 business days.",
    "I'd be happy to look into that! In a future version, I'll be connected to live Austin 311 data. "
    "For now, I'm here to show you how the chat interface works.",
]


def _pick_response(messages: list) -> str:
    return DUMMY_RESPONSES[len(messages) % len(DUMMY_RESPONSES)]


async def _stream_chat(messages: list):
    """Generate SSE events in the Vercel AI SDK data stream protocol."""
    response_text = _pick_response(messages)
    msg_id = str(uuid.uuid4())

    # start
    yield f"data: {json.dumps({'type': 'start', 'messageId': msg_id})}\n\n"
    # text-start
    yield f"data: {json.dumps({'type': 'text-start', 'id': msg_id})}\n\n"

    # stream word by word
    words = response_text.split(" ")
    for i, word in enumerate(words):
        chunk = word if i == 0 else " " + word
        yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': chunk})}\n\n"
        await asyncio.sleep(0.03)

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
