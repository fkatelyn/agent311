# Agent311 API Examples

Quick reference for testing the agent311 chat API.

## Endpoints

- **Local:** `http://localhost:8000/api/chat`
- **Production:** `https://agent311-production.up.railway.app/api/chat`

## Request Format

```json
POST /api/chat
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "Your message here"}
  ]
}
```

## Response Format (SSE Stream)

```
data: {"type":"start","messageId":"550e8400-e29b-41d4-a716-446655440000"}

data: {"type":"text-start","id":"550e8400-e29b-41d4-a716-446655440000"}

data: {"type":"text-delta","id":"550e8400-e29b-41d4-a716-446655440000","delta":"Hello"}

data: {"type":"text-delta","id":"550e8400-e29b-41d4-a716-446655440000","delta":"!"}

data: {"type":"text-end","id":"550e8400-e29b-41d4-a716-446655440000"}

data: {"type":"finish"}

data: [DONE]
```

## Example Conversations

### Example 1: General Question

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "What is Austin 311?"}
  ]
}
```

**Expected Response:**
Claude will explain that Austin 311 is a non-emergency service request system, covering categories like Code Compliance, Resource Recovery, etc.

### Example 2: Data Query

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "How many 311 requests are filed daily in Austin?"}
  ]
}
```

**Expected Response:**
Claude will mention ~1,500-2,000 requests per day based on the system prompt.

### Example 3: API Access

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "How can I access the 311 data programmatically?"}
  ]
}
```

**Expected Response:**
Claude will explain the Socrata API endpoint, dataset ID (i26j-ai4z), and provide example queries.

### Example 4: Multi-turn Conversation

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "What are the main 311 categories?"},
    {"role": "assistant", "content": "The main categories include Code Compliance, Austin Resource Recovery..."},
    {"role": "user", "content": "Tell me more about Code Compliance"}
  ]
}
```

**Expected Response:**
Claude will provide details about Code Compliance services (overgrown vegetation, junk vehicles, etc.).

## Testing with curl

### Basic Test
```bash
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'
```

### Filter for Text Only
```bash
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is 311?"}]}' \
  | grep 'text-delta' \
  | sed 's/.*"delta":"\([^"]*\)".*/\1/' \
  | tr -d '\n'
```

### Production Test
```bash
curl -N -X POST https://agent311-production.up.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Tell me about Austin 311"}]}'
```

## Error Responses

### Missing API Key
```
data: {"type":"text-delta","id":"...","delta":"Error: ANTHROPIC_API_KEY not set"}
```

### Invalid Message Format
```
HTTP 422 Unprocessable Entity
```

### Rate Limit
```
data: {"type":"text-delta","id":"...","delta":"Error: rate_limit_error"}
```

## Performance Benchmarks

- **Local Response Time:** ~500ms-2s (first chunk)
- **Production Response Time:** ~800ms-3s (first chunk)
- **Streaming Speed:** ~50-100 tokens/second
- **Average Response Length:** 200-500 tokens

## Frontend Integration

The frontend at `https://frontend-production-893c.up.railway.app` uses this API with custom SSE parsing:

```javascript
const response = await fetch(API_URL + '/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;

      const event = JSON.parse(data);
      if (event.type === 'text-delta') {
        // Append delta to UI
        appendText(event.delta);
      }
    }
  }
}
```
