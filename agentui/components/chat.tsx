"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { Sidebar } from "@/components/sidebar";
import { ChatMessages } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { ArtifactPanel } from "@/components/artifact-panel";
import { API_URL } from "@/lib/config";
import {
  type ChatSession,
  createSession,
  deleteSession,
  getSession,
  getSessions,
  saveSession,
  titleFromFirstMessage,
} from "@/lib/chat-store";

const VIEW_CONTENT_TOOL_RE = /\[Using tool:\s*view_content\s+([^\]\n]+)\](?:\\n|\n)?/g;

interface FetchFileResponse {
  path: string;
  language: string;
  sizeBytes: number;
  content: string;
}

function normalizeToolPath(rawPath: string): string {
  return rawPath.trim().replace(/^['"]|['"]$/g, "");
}

function extractViewContentPaths(text: string): string[] {
  const matches: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(VIEW_CONTENT_TOOL_RE.source, VIEW_CONTENT_TOOL_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const normalized = normalizeToolPath(match[1] ?? "");
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      matches.push(normalized);
    }
  }

  return matches;
}

function buildArtifactCodeFence(file: FetchFileResponse): string {
  return `\n\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
}

export function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [artifactCode, setArtifactCode] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load sessions on mount
  useEffect(() => {
    const loaded = getSessions();
    setSessions(loaded);
    if (loaded.length > 0) {
      setCurrentSession(loaded[0]);
      setMessages(loaded[0].messages);
    } else {
      const s = createSession();
      saveSession(s);
      setCurrentSession(s);
      setSessions([s]);
    }
  }, []);

  const refreshSessions = useCallback(() => {
    setSessions(getSessions());
  }, []);

  const handleNewChat = useCallback(() => {
    const s = createSession();
    saveSession(s);
    setCurrentSession(s);
    setMessages([]);
    setArtifactCode(null);
    refreshSessions();
  }, [refreshSessions]);

  const handleSelectSession = useCallback((id: string) => {
    const s = getSession(id);
    if (s) {
      setCurrentSession(s);
      setMessages(s.messages);
      setArtifactCode(null);
    }
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession(id);
      const remaining = getSessions();
      setSessions(remaining);
      if (currentSession?.id === id) {
        if (remaining.length > 0) {
          setCurrentSession(remaining[0]);
          setMessages(remaining[0].messages);
        } else {
          handleNewChat();
        }
      }
    },
    [currentSession, handleNewChat]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || !currentSession) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");

      // Update title from first message
      if (messages.length === 0) {
        currentSession.title = titleFromFirstMessage(text);
      }

      // Create assistant message placeholder
      const assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      const allMessages = [...updatedMessages, assistantMessage];
      setMessages(allMessages);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${API_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload);
              if (event.type === "text-delta" && event.delta) {
                fullText += event.delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: fullText }
                      : m
                  )
                );
              }
            } catch {
              // skip unparseable lines
            }
          }
        }

        const viewContentPaths = extractViewContentPaths(fullText);
        let finalText = fullText;

        for (const path of viewContentPaths) {
          try {
            const fetchRes = await fetch(
              `${API_URL}/api/fetch_file?path=${encodeURIComponent(path)}`
            );
            if (!fetchRes.ok) {
              finalText += `\n\nFailed to fetch preview content for ${path} (HTTP ${fetchRes.status}).`;
              continue;
            }

            const file = (await fetchRes.json()) as FetchFileResponse;
            if (typeof file.content === "string" && file.content.length > 0) {
              finalText += buildArtifactCodeFence(file);
            }
          } catch {
            finalText += `\n\nFailed to fetch preview content for ${path}.`;
          }
        }

        // Save session
        const finalMessages = [
          ...updatedMessages,
          { ...assistantMessage, content: finalText },
        ];
        setMessages(finalMessages);
        currentSession.messages = finalMessages;
        currentSession.updatedAt = Date.now();
        saveSession(currentSession);
        refreshSessions();
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const errorText = `Error: ${(err as Error).message}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: errorText }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [currentSession, messages, refreshSessions]
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSession?.id ?? null}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header bar for mobile toggle */}
        {!sidebarOpen && (
          <div className="flex items-center border-b px-4 py-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="ml-3 text-sm font-medium">
              {currentSession?.title ?? "Agent 311"}
            </span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Chat area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
              onOpenPreview={setArtifactCode}
            />
            <ChatInput
              input={input}
              setInput={setInput}
              isStreaming={isStreaming}
              onSubmit={handleSubmit}
              onStop={handleStop}
            />
          </div>

          {/* Artifact panel */}
          {artifactCode && (
            <ArtifactPanel
              code={artifactCode}
              onClose={() => setArtifactCode(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
