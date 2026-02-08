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

You have access to a hello_world tool for testing. When a user asks you to "test the tool", "run hello world", or "demo the skill", use the hello_world tool to show that tool calling works.

Be helpful, accurate, and enthusiastic about Austin's civic data!"""

# Tool definitions
TOOLS = [
    {
        "name": "hello_world",
        "description": "A simple test tool that returns a greeting message. Use this when the user asks to test tools, run hello world, or demo the skill system.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Optional name to include in the greeting"
                }
            }
        }
    }
]


def execute_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a tool and return the result."""
    if tool_name == "hello_world":
        name = tool_input.get("name", "there")
        return f"Hello, {name}! 👋 This is the agent311 hello_world tool responding. Tool calling is working! The backend successfully received the tool request and executed it."
    return f"Unknown tool: {tool_name}"


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
        # First API call with tools
        response = await client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=claude_messages,
            tools=TOOLS,
        )

        # Check if Claude wants to use tools
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                # Execute the tool
                tool_name = block.name
                tool_input = block.input
                tool_result = execute_tool(tool_name, tool_input)

                # Stream the tool execution notification
                yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': f'[Using tool: {tool_name}]\\n'})}\n\n"

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": tool_result
                })

        # If tools were used, make a second API call with results
        if tool_results:
            # Add assistant's response and tool results to messages
            claude_messages.append({
                "role": "assistant",
                "content": response.content
            })
            claude_messages.append({
                "role": "user",
                "content": tool_results
            })

            # Stream the final response
            async with client.messages.stream(
                model="claude-sonnet-4-5-20250929",
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                messages=claude_messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': text})}\n\n"
        else:
            # No tools used, just stream the text response
            for block in response.content:
                if hasattr(block, "text"):
                    # Split into chunks for streaming effect
                    text = block.text
                    chunk_size = 5
                    for i in range(0, len(text), chunk_size):
                        chunk = text[i:i+chunk_size]
                        yield f"data: {json.dumps({'type': 'text-delta', 'id': msg_id, 'delta': chunk})}\n\n"

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
