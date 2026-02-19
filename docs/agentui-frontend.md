# agentui Frontend Architecture

The `agentui/` directory contains a Next.js 16 frontend inspired by the Claude.ai chat interface. It uses [AI Elements](https://elements.ai-sdk.dev/) for core UI primitives and custom components for artifact previewing, tool call rendering, and session management.

Live URL: see `railway domain` in the `agentui/` service directory

## Layout

```
+---------------+----------------------------+--------------------+
|   Sidebar     |       Chat Area            |  Artifact Panel    |
|               |                            |  (resizable)       |
| + New Chat    |  [Tool summary]            |                    |
|   Session 1   |  Markdown response         |  Preview | Code    |
|   Session 2   |  [Artifact Card] --------> |  (iframe or JSX)   |
|   Session 3   |                            |                    |
|               |  [PromptInput]             |  [drag handle]     |
| [Model v]     |                            |  [X close]         |
+---------------+----------------------------+--------------------+
```

- Sidebar collapses via toggle button
- Artifact panel appears only when a code block is selected
- Panel width is adjustable via a drag handle (20%–80%)

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Markdown:** Streamdown (via AI Elements `MessageResponse`)
- **Chat persistence:** PostgreSQL (via backend API)
- **Backend communication:** Custom SSE fetch (not AI SDK `useChat`)
- **Deployment:** Railway (Railpack)

## AI Elements Components

Installed via `npx ai-elements@latest add <component>`. Source lives in `components/ai-elements/`.

| Component | File | Used In | Purpose |
|-----------|------|---------|---------|
| **Message** | `message.tsx` | `chat-messages.tsx` | `Message`, `MessageContent`, `MessageResponse` — renders user/assistant messages with Streamdown markdown |
| **PromptInput** | `prompt-input.tsx` | `chat-input.tsx` | `PromptInput`, `PromptInputTextarea`, `PromptInputFooter`, `PromptInputSubmit` — chat input with Enter to submit, stop button during streaming |
| **ModelSelector** | `model-selector.tsx` | `sidebar.tsx` | `ModelSelector`, `ModelSelectorTrigger`, `ModelSelectorContent`, `ModelSelectorLogo`, `ModelSelectorName` — model picker (UI placeholder, single model) |
| **Artifact** | `artifact.tsx` | `artifact-panel.tsx` | `Artifact`, `ArtifactHeader`, `ArtifactTitle`, `ArtifactActions`, `ArtifactClose`, `ArtifactContent` — container for the preview panel |
| **JSXPreview** | `jsx-preview.tsx` | `artifact-panel.tsx` | `JSXPreview`, `JSXPreviewContent`, `JSXPreviewError` — live JSX rendering via `react-jsx-parser` |
| **CodeBlock** | `code-block.tsx` | `artifact-panel.tsx` | `CodeBlock`, `CodeBlockHeader`, `CodeBlockTitle`, `CodeBlockCopyButton`, `CodeBlockActions` — syntax-highlighted code display via Shiki |
| **Tool** | `tool.tsx` | (available) | `Tool`, `ToolHeader`, `ToolContent`, `ToolInput`, `ToolOutput` — collapsible tool call display (installed but replaced by custom `ToolSummary`) |

### Streamdown CSS

`app/globals.css` includes `@source "../node_modules/streamdown/dist/*.js"` so Tailwind 4 picks up Streamdown's class names for markdown rendering.

## Custom Components

### `chat.tsx` — Main Orchestrator

The root component managing all state and layout.

**State:** `sessions`, `currentSession`, `messages`, `input`, `isStreaming`, `sidebarOpen`, `artifactCode`

**SSE Streaming:** Uses manual `fetch` + `ReadableStream` to consume the backend's custom SSE protocol (`text-delta` events). Does NOT use AI SDK's `useChat` hook because the backend uses a non-standard stream format.

**Message flow:**
1. User types in PromptInput, calls `handleSubmit(text)`
2. POST to `${API_URL}/api/chat` with messages array + session_id (JWT auth header)
3. Stream `text-delta` events, accumulate into assistant message
4. Detects `[Using tool: view_content <path>]` markers, fetches file via `/api/fetch_file`, appends code block
5. On completion, session/messages are already persisted to PostgreSQL by the backend

### `chat-messages.tsx` — Message List with Parsing

Renders the message list with three layers of post-processing on completed assistant messages:

#### 1. Tool Call Summary (`ToolSummary`)

Parses `[Using tool: Write]` markers from the raw text and collapses them into a single summary line:

```
Created a file, read a file >
```

- Clickable chevron expands to show raw tool names
- Deduplicates and counts repeated tools: "Read a file (3x)"
- Tool-to-label mapping: `Write` → "Created a file", `Bash` → "Ran a command", etc.
- Regex: `/\[Using tool: (\w+)\]\\?n?/g`

#### 2. Artifact Card (`ArtifactCard`)

Replaces inline code blocks with a clickable card (inspired by Claude.ai artifacts):

```
+------+------------------+-----------------+
| </>  | Title            | [Open Preview]  |
|      | Code · HTML      |                 |
+------+------------------+-----------------+
```

- Extracts code from ` ```html`, ` ```jsx`, ` ```tsx`, ` ```js`, ` ```javascript` blocks
- Title auto-detected from `<title>` tag in HTML, or defaults to "Index"
- Language label derived from fence language
- Clicking opens the artifact panel
- Raw code blocks are **stripped** from the markdown text before rendering

#### 3. Streaming Mode

During active streaming (`isAssistantStreaming`), the raw content is rendered as-is through `MessageResponse mode="streaming"`. Tool/artifact parsing only runs on completed messages.

### `artifact-panel.tsx` — Preview Panel

Right-side split panel with two tabs (Preview and Code) and a resizable width.

#### HTML Document Detection

`isFullHtmlDocument(code)` checks if content starts with `<!doctype` or `<html`. This determines the rendering strategy:

- **Full HTML documents** → rendered in a **sandboxed iframe** (`<iframe srcDoc={code} sandbox="allow-scripts">`)
- **JSX/TSX fragments** → rendered via AI Elements `JSXPreview` (react-jsx-parser)

#### Tabs

| Tab | HTML Documents | JSX Fragments |
|-----|---------------|---------------|
| **Preview** | `HtmlIframePreview` (iframe) | `JSXPreview` + `JSXPreviewContent` |
| **Code** | `CodeBlock` with `language="html"` | `CodeBlock` with `language="tsx"` |

#### Draggable Resize Handle

A mouse-drag handle on the left edge of the panel:

- **Visual:** 8px-tall rounded pill (`bg-muted-foreground/40`), centered vertically in a 12px-wide hit area
- **Behavior:** `mousedown` → `mousemove` → `mouseup` cycle, calculates width as percentage of `window.innerWidth`
- **Constraints:** Min 20%, max 80%, with `min-w-[320px]` floor
- **UX:** Sets `cursor: col-resize` and `user-select: none` on `document.body` during drag

### `sidebar.tsx` — Session Sidebar

Left panel (256px) with:

- **Header:** "Agent 311" title, New Chat (+) button, collapse button
- **Session list:** Scrollable list of sessions from PostgreSQL, sorted by most recent. Favorites pinned to top. Active session highlighted. Star button to toggle favorite. Delete button with confirmation dialog on hover.
- **Model selector:** AI Elements `ModelSelector` at bottom (placeholder — single "Claude (Agent 311)" option)

### `chat-input.tsx` — Input Area

Wraps AI Elements `PromptInput` with:

- `PromptInputTextarea` — Enter to submit, Shift+Enter for newline
- `PromptInputSubmit` — Submit button, switches to Stop button during streaming (`status="streaming"`)

## Library Files

### `lib/session-api.ts` — Backend Session API

REST API calls to backend PostgreSQL session endpoints (all authenticated via `authFetch`):

```typescript
interface ApiSession {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  isFavorite: boolean;
  messages?: ChatMessage[];
}
```

Functions: `fetchSessions()`, `fetchSession(id)`, `createSessionApi(id, title)`, `updateSessionTitle(id, title)`, `toggleFavoriteApi(id, isFavorite)`, `deleteSessionApi(id)`, `titleFromFirstMessage(text)`

### `lib/auth.ts` — JWT Auth

JWT token stored in localStorage under key `"agentui-token"`:
- `login()` — POST to `/api/auth/login` with hardcoded credentials, stores returned token
- `authFetch(url, options)` — Wraps `fetch` with `Authorization: Bearer <token>` header; redirects to `/login` on 401
- `getToken()`, `setToken()`, `clearToken()`, `isLoggedIn()`, `logout()`

### `lib/types.ts` — Message Type

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
```

Custom type (instead of AI SDK's `UIMessage`, which only has `parts` in v6, not `content`).

### `lib/config.ts` — API URL

```typescript
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
```

## Deployment

Railway service `agentui` in project `powerful-dream`:

- **Root directory:** `/agentui` (set via Railway dashboard)
- **Builder:** Railpack (auto-detects Next.js from `package.json`)
- **Environment variable:** `NEXT_PUBLIC_API_URL` — set in Railway dashboard (get URL via `railway domain` in the backend service dir)
- **Node.js:** Requires 20+ (`"engines": {"node": ">=20.9.0"}` in package.json)

Config files: `agentui/railpack.json`, `agentui/railway.json`

## File Map

```
agentui/
├── app/
│   ├── layout.tsx              # Root layout (dark mode, Geist fonts)
│   ├── page.tsx                # Renders <Chat />
│   └── globals.css             # Tailwind 4 + Streamdown @source
├── components/
│   ├── chat.tsx                # Main orchestrator (SSE, state, layout)
│   ├── chat-messages.tsx       # Message list + tool summary + artifact cards
│   ├── chat-input.tsx          # PromptInput wrapper
│   ├── sidebar.tsx             # Session list + model selector
│   ├── artifact-panel.tsx      # Preview panel (iframe/JSX + code + resize)
│   ├── ai-elements/            # AI Elements (auto-generated)
│   │   ├── message.tsx
│   │   ├── prompt-input.tsx
│   │   ├── jsx-preview.tsx
│   │   ├── model-selector.tsx
│   │   ├── artifact.tsx
│   │   ├── code-block.tsx
│   │   └── tool.tsx
│   └── ui/                     # shadcn/ui primitives
│       ├── button.tsx
│       ├── badge.tsx
│       ├── collapsible.tsx
│       ├── tabs.tsx
│       ├── sheet.tsx
│       ├── scroll-area.tsx
│       └── ...
├── lib/
│   ├── config.ts               # API_URL
│   ├── session-api.ts          # Backend session CRUD (fetchSessions, createSessionApi, etc.)
│   ├── auth.ts                 # JWT login, token storage, authFetch wrapper
│   ├── types.ts                # ChatMessage type
│   └── utils.ts                # cn() utility
├── railpack.json               # Railway deployment config
├── railway.json                # Railpack builder config
└── package.json                # engines: node >=20.9.0
```
